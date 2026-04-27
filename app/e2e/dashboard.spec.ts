import { test, expect } from '@playwright/test';

const SALESPERSON_EMAIL = 'yamada@test.com';
const MANAGER_EMAIL = 'suzuki@test.com';
const PASSWORD = 'Test1234!';

async function loginAs(page: Parameters<typeof test>[1], email: string) {
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(PASSWORD);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.describe('ダッシュボード・日報一覧 (SCR-002)', () => {
  test('営業担当ログイン後に日報一覧画面が表示される', async ({ page }) => {
    await loginAs(page, SALESPERSON_EMAIL);

    // ダッシュボードは / または /reports に遷移
    // 日報一覧テーブルのヘッダーカラムを確認
    await page.goto('/');
    await expect(page.getByRole('columnheader', { name: '日付' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '訪問件数' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'コメント有無' })).toBeVisible();
  });

  test('営業担当の一覧には「営業名」カラムが表示されない', async ({ page }) => {
    await loginAs(page, SALESPERSON_EMAIL);
    await page.goto('/');

    // 営業担当（非マネージャー）には「営業名」列は表示されない仕様
    await expect(page.getByRole('columnheader', { name: '営業名' })).not.toBeVisible();
  });

  test('マネージャーログイン後に日報一覧画面が表示される（「営業名」カラムあり）', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL);
    await page.goto('/');

    await expect(page.getByRole('columnheader', { name: '日付' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '営業名' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '訪問件数' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'コメント有無' })).toBeVisible();
  });

  test('営業担当のダッシュボードに「+ 新規日報作成」ボタンが表示される', async ({ page }) => {
    await loginAs(page, SALESPERSON_EMAIL);
    await page.goto('/');

    await expect(page.getByRole('button', { name: '+ 新規日報作成' })).toBeVisible();
  });

  test('マネージャーのダッシュボードには「+ 新規日報作成」ボタンが表示されない', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL);
    await page.goto('/');

    // マネージャーは日報作成不可（仕様）
    await expect(page.getByRole('button', { name: '+ 新規日報作成' })).not.toBeVisible();
  });
});
