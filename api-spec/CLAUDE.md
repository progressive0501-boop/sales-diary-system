# API仕様書：営業日報システム

**バージョン：** 1.0  
**作成日：** 2026-04-13  
**ベースURL：** `https://api.example.com/v1`

---

## 技術スタック（バックエンド）

| 項目 | 技術 |
|------|------|
| 言語 | TypeScript |
| フレームワーク | Next.js Route Handlers（App Router） |
| APIスキーマ定義 | OpenAPI（Zodによるリクエスト検証） |
| DBスキーマ定義 | Prisma.js |
| デプロイ | Vercel |

## ESLint設定方針

### 使用パッケージ

```bash
eslint-config-next              # Next.js公式（TypeScript含む）
eslint-plugin-prisma (任意)     # Prismaのアンチパターン検出
```

### 主要ルール

| ルール | 設定 | 理由 |
|--------|------|------|
| `@typescript-eslint/no-explicit-any` | error | `any`型の使用禁止。ZodスキーマとPrisma型で型安全を保証する |
| `@typescript-eslint/no-unused-vars` | error | 未使用変数の禁止 |
| `@typescript-eslint/consistent-type-imports` | error | `import type`を強制。バンドルサイズ削減 |
| `@typescript-eslint/no-floating-promises` | error | `await`忘れによるPromise未処理を検出 |
| `no-throw-literal` | error | `throw`はErrorオブジェクトのみ許可 |

### Zodによるリクエスト検証の方針

- すべてのRoute HandlerはZodスキーマでリクエストボディ・クエリパラメータを検証する
- バリデーションエラーは `400 VALIDATION_ERROR` として返す
- `z.infer<typeof schema>` でPrisma呼び出し時の型を保証する

### 設定ファイル（`eslint.config.mjs` 抜粋）

```js
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat()

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      'no-throw-literal': 'error',
    },
  },
]
```

---

---

## 目次

1. [共通仕様](#共通仕様)
2. [認証 API](#認証-api)
3. [日報 API](#日報-api)
4. [訪問記録 API](#訪問記録-api)
5. [コメント API](#コメント-api)
6. [顧客マスタ API](#顧客マスタ-api)
7. [営業マスタ API](#営業マスタ-api)

---

## 共通仕様

### 認証方式

ログイン後に発行されるJWTトークンをすべてのAPIリクエストヘッダーに付与する。

```
Authorization: Bearer {JWT_TOKEN}
```

### 共通レスポンス形式

**成功時**
```json
{
  "success": true,
  "data": { ... }
}
```

**失敗時**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容に誤りがあります",
    "details": [
      { "field": "name", "message": "顧客名を入力してください" }
    ]
  }
}
```

### HTTPステータスコード

| コード | 意味 | 主な使用場面 |
|--------|------|-------------|
| 200 | OK | 取得・更新成功 |
| 201 | Created | 新規作成成功 |
| 400 | Bad Request | バリデーションエラー |
| 401 | Unauthorized | 未認証・トークン期限切れ |
| 403 | Forbidden | 権限不足 |
| 404 | Not Found | リソースが存在しない |
| 409 | Conflict | 重複エラー（例：同日の日報が既に存在） |
| 500 | Internal Server Error | サーバー内部エラー |

### エラーコード一覧

| コード | 説明 |
|--------|------|
| `VALIDATION_ERROR` | 入力値バリデーション失敗 |
| `UNAUTHORIZED` | 認証エラー |
| `FORBIDDEN` | 権限エラー |
| `NOT_FOUND` | リソースが見つからない |
| `CONFLICT` | リソースの重複 |
| `INTERNAL_ERROR` | サーバー内部エラー |

### ページネーション

一覧取得APIは共通のクエリパラメータでページネーションを行う。

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `page` | integer | 1 | ページ番号（1始まり） |
| `per_page` | integer | 20 | 1ページあたりの件数（最大100） |

レスポンスの `data` に以下のページネーション情報を含む。

```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "pagination": {
      "total": 100,
      "total_pages": 5,
      "current_page": 1,
      "per_page": 20
    }
  }
}
```

---

## 認証 API

### POST /auth/login

ログイン認証を行い、JWTトークンを発行する。

**認証：** 不要

**リクエストボディ**

```json
{
  "email": "yamada@example.co.jp",
  "password": "password123"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `email` | string | ○ | メールアドレス |
| `password` | string | ○ | パスワード |

**レスポンス（200 OK）**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": "2026-04-14T09:00:00Z",
    "user": {
      "id": 1,
      "name": "山田 太郎",
      "email": "yamada@example.co.jp",
      "is_manager": false
    }
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `VALIDATION_ERROR` | email・passwordが未入力 |
| 401 | `UNAUTHORIZED` | メールアドレスまたはパスワードが不正 |

---

### POST /auth/logout

ログアウトし、JWTトークンを無効化する。

**認証：** 必要

**リクエストボディ：** なし

**レスポンス（200 OK）**

```json
{
  "success": true,
  "data": null
}
```

---

## 日報 API

### GET /reports

日報の一覧を取得する。営業は自分の日報のみ取得可能。上長は配下営業全員の日報を取得可能。

**認証：** 必要

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `salesperson_id` | integer | — | 上長のみ指定可。指定しない場合は配下全員 |
| `year_month` | string | — | `YYYY-MM` 形式で月絞り込み |
| `page` | integer | — | ページ番号（デフォルト：1） |
| `per_page` | integer | — | 件数（デフォルト：20） |

**レスポンス（200 OK）**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 101,
        "salesperson_id": 1,
        "salesperson_name": "山田 太郎",
        "report_date": "2026-04-13",
        "visit_count": 3,
        "has_comment": true,
        "created_at": "2026-04-13T19:00:00Z",
        "updated_at": "2026-04-13T19:30:00Z"
      }
    ],
    "pagination": {
      "total": 42,
      "total_pages": 3,
      "current_page": 1,
      "per_page": 20
    }
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 403 | `FORBIDDEN` | 他営業のIDを営業ユーザーが指定した場合 |

---

### GET /reports/{report_id}

指定した日報の詳細を取得する。

**認証：** 必要

**パスパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `report_id` | integer | 日報ID |

**レスポンス（200 OK）**

```json
{
  "success": true,
  "data": {
    "id": 101,
    "salesperson_id": 1,
    "salesperson_name": "山田 太郎",
    "report_date": "2026-04-13",
    "problem": "株式会社Aの見積もり条件について上長に確認したい。",
    "plan": "株式会社Aへ見積書を送付する。",
    "visit_records": [
      {
        "id": 201,
        "customer_id": 10,
        "customer_name": "田中 一郎",
        "customer_company": "株式会社A",
        "visit_content": "新製品の提案を実施。先方に概ね好感触を得た。",
        "visit_order": 1
      },
      {
        "id": 202,
        "customer_id": 11,
        "customer_name": "佐藤 花子",
        "customer_company": "株式会社B",
        "visit_content": "定期訪問。次回商談の日程調整を行った。",
        "visit_order": 2
      }
    ],
    "comments": {
      "problem": [
        {
          "id": 301,
          "commenter_id": 5,
          "commenter_name": "鈴木 部長",
          "content": "見積もりは標準条件で対応してください。",
          "created_at": "2026-04-13T20:00:00Z"
        }
      ],
      "plan": []
    },
    "created_at": "2026-04-13T19:00:00Z",
    "updated_at": "2026-04-13T19:30:00Z"
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 403 | `FORBIDDEN` | 閲覧権限のない日報へのアクセス |
| 404 | `NOT_FOUND` | 日報が存在しない |

---

### POST /reports

日報を新規作成する。

**認証：** 必要（営業ユーザーのみ）

**リクエストボディ**

```json
{
  "report_date": "2026-04-13",
  "problem": "株式会社Aの見積もり条件について上長に確認したい。",
  "plan": "株式会社Aへ見積書を送付する。",
  "visit_records": [
    {
      "customer_id": 10,
      "visit_content": "新製品の提案を実施。先方に概ね好感触を得た。",
      "visit_order": 1
    },
    {
      "customer_id": 11,
      "visit_content": "定期訪問。次回商談の日程調整を行った。",
      "visit_order": 2
    }
  ]
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|----------------|
| `report_date` | string | ○ | `YYYY-MM-DD` 形式 |
| `problem` | string | — | 最大2000文字 |
| `plan` | string | — | 最大2000文字 |
| `visit_records` | array | ○ | 1件以上 |
| `visit_records[].customer_id` | integer | ○ | 顧客マスタに存在するID |
| `visit_records[].visit_content` | string | ○ | 最大1000文字 |
| `visit_records[].visit_order` | integer | ○ | 1以上の整数 |

**レスポンス（201 Created）**

```json
{
  "success": true,
  "data": {
    "id": 101,
    "report_date": "2026-04-13"
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `VALIDATION_ERROR` | バリデーション失敗 |
| 403 | `FORBIDDEN` | 上長ユーザーによる作成 |
| 409 | `CONFLICT` | 同日の日報が既に存在する |

---

### PUT /reports/{report_id}

日報を更新する。作成者本人のみ可能。

**認証：** 必要（作成者本人のみ）

**パスパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `report_id` | integer | 日報ID |

**リクエストボディ**（POST /reports と同じ形式）

**レスポンス（200 OK）**

```json
{
  "success": true,
  "data": {
    "id": 101,
    "report_date": "2026-04-13",
    "updated_at": "2026-04-13T20:00:00Z"
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `VALIDATION_ERROR` | バリデーション失敗 |
| 403 | `FORBIDDEN` | 作成者以外による更新 |
| 404 | `NOT_FOUND` | 日報が存在しない |

---

## 訪問記録 API

訪問記録は日報の作成・更新（POST /reports, PUT /reports）と同時に操作するため、単独のエンドポイントは原則不要。必要に応じて以下を提供する。

### GET /reports/{report_id}/visit_records

指定した日報の訪問記録一覧を取得する。

**認証：** 必要

**パスパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `report_id` | integer | 日報ID |

**レスポンス（200 OK）**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 201,
        "customer_id": 10,
        "customer_name": "田中 一郎",
        "customer_company": "株式会社A",
        "visit_content": "新製品の提案を実施。",
        "visit_order": 1
      }
    ]
  }
}
```

---

## コメント API

### GET /reports/{report_id}/comments

指定した日報のコメント一覧を取得する。

**認証：** 必要

**パスパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `report_id` | integer | 日報ID |

**レスポンス（200 OK）**

```json
{
  "success": true,
  "data": {
    "problem": [
      {
        "id": 301,
        "commenter_id": 5,
        "commenter_name": "鈴木 部長",
        "content": "見積もりは標準条件で対応してください。",
        "created_at": "2026-04-13T20:00:00Z"
      }
    ],
    "plan": []
  }
}
```

---

### POST /reports/{report_id}/comments

指定した日報にコメントを投稿する。上長ユーザーのみ可能。

**認証：** 必要（上長ユーザーのみ）

**パスパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `report_id` | integer | 日報ID |

**リクエストボディ**

```json
{
  "target_type": "problem",
  "content": "見積もりは標準条件で対応してください。"
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|----------------|
| `target_type` | string | ○ | `"problem"` または `"plan"` のいずれか |
| `content` | string | ○ | 1文字以上・最大2000文字 |

**レスポンス（201 Created）**

```json
{
  "success": true,
  "data": {
    "id": 301,
    "report_id": 101,
    "target_type": "problem",
    "commenter_id": 5,
    "commenter_name": "鈴木 部長",
    "content": "見積もりは標準条件で対応してください。",
    "created_at": "2026-04-13T20:00:00Z"
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `VALIDATION_ERROR` | バリデーション失敗 |
| 403 | `FORBIDDEN` | 営業ユーザーによる投稿、または配下以外の日報へのコメント |
| 404 | `NOT_FOUND` | 日報が存在しない |

---

## 顧客マスタ API

### GET /customers

顧客一覧を取得する。

**認証：** 必要

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `q` | string | — | 顧客名・会社名の部分一致検索 |
| `page` | integer | — | ページ番号（デフォルト：1） |
| `per_page` | integer | — | 件数（デフォルト：20） |

**レスポンス（200 OK）**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 10,
        "name": "田中 一郎",
        "company": "株式会社A",
        "phone": "03-1234-5678",
        "address": "東京都千代田区...",
        "assigned_salesperson_id": 1,
        "assigned_salesperson_name": "山田 太郎"
      }
    ],
    "pagination": {
      "total": 60,
      "total_pages": 3,
      "current_page": 1,
      "per_page": 20
    }
  }
}
```

---

### GET /customers/{customer_id}

指定した顧客の詳細を取得する。

**認証：** 必要

**パスパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `customer_id` | integer | 顧客ID |

**レスポンス（200 OK）**

```json
{
  "success": true,
  "data": {
    "id": 10,
    "name": "田中 一郎",
    "company": "株式会社A",
    "phone": "03-1234-5678",
    "address": "東京都千代田区...",
    "assigned_salesperson_id": 1,
    "assigned_salesperson_name": "山田 太郎"
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 404 | `NOT_FOUND` | 顧客が存在しない |

---

### POST /customers

顧客を新規登録する。上長ユーザーのみ可能。

**認証：** 必要（上長ユーザーのみ）

**リクエストボディ**

```json
{
  "name": "田中 一郎",
  "company": "株式会社A",
  "phone": "03-1234-5678",
  "address": "東京都千代田区...",
  "assigned_salesperson_id": 1
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|----------------|
| `name` | string | ○ | 最大100文字 |
| `company` | string | ○ | 最大200文字 |
| `phone` | string | — | 電話番号形式 |
| `address` | string | — | 最大300文字 |
| `assigned_salesperson_id` | integer | ○ | SALESPERSONに存在するID |

**レスポンス（201 Created）**

```json
{
  "success": true,
  "data": {
    "id": 10,
    "name": "田中 一郎",
    "company": "株式会社A"
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `VALIDATION_ERROR` | バリデーション失敗 |
| 403 | `FORBIDDEN` | 営業ユーザーによる登録 |

---

### PUT /customers/{customer_id}

顧客情報を更新する。上長ユーザーのみ可能。

**認証：** 必要（上長ユーザーのみ）

**パスパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `customer_id` | integer | 顧客ID |

**リクエストボディ**（POST /customers と同じ形式）

**レスポンス（200 OK）**

```json
{
  "success": true,
  "data": {
    "id": 10,
    "name": "田中 一郎",
    "company": "株式会社A"
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `VALIDATION_ERROR` | バリデーション失敗 |
| 403 | `FORBIDDEN` | 営業ユーザーによる更新 |
| 404 | `NOT_FOUND` | 顧客が存在しない |

---

## 営業マスタ API

### GET /salespersons

営業一覧を取得する。上長ユーザーのみ可能。

**認証：** 必要（上長ユーザーのみ）

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `q` | string | — | 氏名の部分一致検索 |
| `page` | integer | — | ページ番号（デフォルト：1） |
| `per_page` | integer | — | 件数（デフォルト：20） |

**レスポンス（200 OK）**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "山田 太郎",
        "email": "yamada@example.co.jp",
        "department": "東日本営業部",
        "is_manager": false,
        "manager_id": 5,
        "manager_name": "鈴木 部長"
      }
    ],
    "pagination": {
      "total": 10,
      "total_pages": 1,
      "current_page": 1,
      "per_page": 20
    }
  }
}
```

---

### GET /salespersons/{salesperson_id}

指定した営業の詳細を取得する。上長ユーザーのみ可能。

**認証：** 必要（上長ユーザーのみ）

**パスパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `salesperson_id` | integer | 営業ID |

**レスポンス（200 OK）**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "山田 太郎",
    "email": "yamada@example.co.jp",
    "department": "東日本営業部",
    "is_manager": false,
    "manager_id": 5,
    "manager_name": "鈴木 部長"
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 403 | `FORBIDDEN` | 営業ユーザーによるアクセス |
| 404 | `NOT_FOUND` | 営業が存在しない |

---

### POST /salespersons

営業を新規登録する。上長ユーザーのみ可能。

**認証：** 必要（上長ユーザーのみ）

**リクエストボディ**

```json
{
  "name": "山田 太郎",
  "email": "yamada@example.co.jp",
  "password": "password123",
  "department": "東日本営業部",
  "manager_id": 5,
  "is_manager": false
}
```

| フィールド | 型 | 必須 | バリデーション |
|-----------|-----|------|----------------|
| `name` | string | ○ | 最大100文字 |
| `email` | string | ○ | メール形式・重複不可 |
| `password` | string | ○ | 8文字以上 |
| `department` | string | — | 最大100文字 |
| `manager_id` | integer | ○ | is_manager=true のユーザーID |
| `is_manager` | boolean | ○ | — |

**レスポンス（201 Created）**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "山田 太郎",
    "email": "yamada@example.co.jp"
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `VALIDATION_ERROR` | バリデーション失敗 |
| 403 | `FORBIDDEN` | 営業ユーザーによる登録 |
| 409 | `CONFLICT` | メールアドレスが既に使用されている |

---

### PUT /salespersons/{salesperson_id}

営業情報を更新する。上長ユーザーのみ可能。

**認証：** 必要（上長ユーザーのみ）

**パスパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `salesperson_id` | integer | 営業ID |

**リクエストボディ**（`password` を除き POST /salespersons と同じ形式）

**レスポンス（200 OK）**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "山田 太郎",
    "email": "yamada@example.co.jp"
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `VALIDATION_ERROR` | バリデーション失敗 |
| 403 | `FORBIDDEN` | 営業ユーザーによる更新 |
| 404 | `NOT_FOUND` | 営業が存在しない |
| 409 | `CONFLICT` | メールアドレスが既に使用されている |

---

## エンドポイント一覧

| メソッド | パス | 説明 | 営業 | 上長 |
|---------|------|------|------|------|
| POST | `/auth/login` | ログイン | ○ | ○ |
| POST | `/auth/logout` | ログアウト | ○ | ○ |
| GET | `/reports` | 日報一覧取得 | ○（自分のみ） | ○（配下全員） |
| GET | `/reports/{id}` | 日報詳細取得 | ○（自分のみ） | ○（配下全員） |
| POST | `/reports` | 日報作成 | ○ | ✕ |
| PUT | `/reports/{id}` | 日報更新 | ○（本人のみ） | ✕ |
| GET | `/reports/{id}/visit_records` | 訪問記録取得 | ○ | ○ |
| GET | `/reports/{id}/comments` | コメント一覧取得 | ○ | ○ |
| POST | `/reports/{id}/comments` | コメント投稿 | ✕ | ○ |
| GET | `/customers` | 顧客一覧取得 | ○ | ○ |
| GET | `/customers/{id}` | 顧客詳細取得 | ○ | ○ |
| POST | `/customers` | 顧客登録 | ✕ | ○ |
| PUT | `/customers/{id}` | 顧客更新 | ✕ | ○ |
| GET | `/salespersons` | 営業一覧取得 | ✕ | ○ |
| GET | `/salespersons/{id}` | 営業詳細取得 | ✕ | ○ |
| POST | `/salespersons` | 営業登録 | ✕ | ○ |
| PUT | `/salespersons/{id}` | 営業更新 | ✕ | ○ |
