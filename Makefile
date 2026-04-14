APP_DIR := app

.PHONY: setup dev build start test test-watch test-coverage lint type-check \
        deploy-preview deploy-prod

# ──────────────────────────────────────────
# 開発
# ──────────────────────────────────────────
setup:
	cd $(APP_DIR) && npm install

dev:
	cd $(APP_DIR) && npm run dev

build:
	cd $(APP_DIR) && npm run build

start:
	cd $(APP_DIR) && npm run start

# ──────────────────────────────────────────
# 品質チェック
# ──────────────────────────────────────────
lint:
	cd $(APP_DIR) && npm run lint

type-check:
	cd $(APP_DIR) && npx tsc --noEmit

test:
	cd $(APP_DIR) && npm test

test-watch:
	cd $(APP_DIR) && npm run test:watch

test-coverage:
	cd $(APP_DIR) && npm run test:coverage

# lint + type-check + test をまとめて実行
check: lint type-check test

# ──────────────────────────────────────────
# デプロイ (Vercel CLI)
# 事前に `npx vercel link` でプロジェクトを紐付けること
# ──────────────────────────────────────────
deploy-preview:
	cd $(APP_DIR) && npx vercel deploy

deploy-prod:
	cd $(APP_DIR) && npx vercel deploy --prod
