import { test, expect } from '@playwright/test';

const SALESPERSON_EMAIL = 'yamada@test.com';
const MANAGER_EMAIL = 'suzuki@test.com';
const PASSWORD = 'Test1234!';
const WRONG_PASSWORD = 'WrongPass999!';

test.describe('認証 (SCR-001)', () => {
  test('未ログイン状態で / にアクセスすると /login にリダイレクトされる', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('未ログイン状態で /reports にアクセスすると /login にリダイレクトされる', async ({ page }) => {
    await page.goto('/reports');
    await expect(page).toHaveURL(/\/login/);
  });

  test('誤パスワードでログインするとエラーメッセージが表示される', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('メールアドレス').fill(SALESPERSON_EMAIL);
    await page.getByLabel('パスワード').fill(WRONG_PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).click();

    // Next.js のルートアナウンサー div[role="alert"] と区別するため p 要素に絞り込む
    const errorMsg = page.locator('p[role="alert"]');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText('メールアドレスまたはパスワードが正しくありません');
  });

  test('メールアドレス未入力でログインするとバリデーションエラーが表示される', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('パスワード').fill(PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).click();

    await expect(page.getByText('メールアドレスを入力してください')).toBeVisible();
  });

  test('パスワード未入力でログインするとバリデーションエラーが表示される', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('メールアドレス').fill(SALESPERSON_EMAIL);
    await page.getByRole('button', { name: 'ログイン' }).click();

    await expect(page.getByText('パスワードを入力してください')).toBeVisible();
  });

  test('営業担当（yamada）が正しい認証情報でログインするとダッシュボードに遷移する', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('メールアドレス').fill(SALESPERSON_EMAIL);
    await page.getByLabel('パスワード').fill(PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).click();

    // ダッシュボード（/reports か /）に遷移していることを確認
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText('営業日報システム')).toBeVisible();
  });

  test('マネージャー（suzuki）が正しい認証情報でログインするとダッシュボードに遷移する', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('メールアドレス').fill(MANAGER_EMAIL);
    await page.getByLabel('パスワード').fill(PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).click();

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText('営業日報システム')).toBeVisible();
  });

  test('ログアウトするとログイン画面に戻る', async ({ page }) => {
    // まずログイン
    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(SALESPERSON_EMAIL);
    await page.getByLabel('パスワード').fill(PASSWORD);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await expect(page).not.toHaveURL(/\/login/);

    // ログアウトボタンをクリック
    await page.getByRole('button', { name: 'ログアウト' }).click();

    // ログイン画面に戻ることを確認
    await expect(page).toHaveURL(/\/login/);
  });
});
