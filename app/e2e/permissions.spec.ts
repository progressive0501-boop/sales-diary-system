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

test.describe('権限制御', () => {
  test('営業担当のナビゲーションには「営業マスタ」リンクが表示されない', async ({ page }) => {
    await loginAs(page, SALESPERSON_EMAIL);

    const nav = page.getByRole('navigation', { name: 'グローバルナビゲーション' });
    await expect(nav.getByRole('link', { name: '日報一覧' })).toBeVisible();
    await expect(nav.getByRole('link', { name: '顧客マスタ' })).toBeVisible();
    await expect(nav.getByRole('link', { name: '営業マスタ' })).not.toBeVisible();
  });

  test('マネージャーのナビゲーションには「営業マスタ」リンクが表示される', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL);

    const nav = page.getByRole('navigation', { name: 'グローバルナビゲーション' });
    await expect(nav.getByRole('link', { name: '日報一覧' })).toBeVisible();
    await expect(nav.getByRole('link', { name: '顧客マスタ' })).toBeVisible();
    await expect(nav.getByRole('link', { name: '営業マスタ' })).toBeVisible();
  });

  test('営業担当が /salespersons に直接アクセスすると /login か / にリダイレクトされる', async ({ page }) => {
    await loginAs(page, SALESPERSON_EMAIL);
    await page.goto('/salespersons');

    // 営業マスタページは表示されないはず
    await expect(page).not.toHaveURL(/\/salespersons/);
  });

  test('マネージャーが /salespersons にアクセスすると営業マスタ一覧が表示される', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL);
    await page.goto('/salespersons');

    await expect(page).toHaveURL(/\/salespersons/);
    // ページが正常に読み込まれていること（タイトルまたは何らかのコンテンツ）
    await expect(page.locator('body')).not.toContainText('404');
  });

  test('ヘッダーにログインユーザー名が表示される', async ({ page }) => {
    await loginAs(page, SALESPERSON_EMAIL);

    const header = page.locator('header');
    // yamada@test.com → 山田 太郎（シードデータに基づく）
    await expect(header).toContainText('山田 太郎');
  });

  test('マネージャーのヘッダーにマネージャー名が表示される', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL);

    const header = page.locator('header');
    // suzuki@test.com → 鈴木 部長（シードデータに基づく）
    await expect(header).toContainText('鈴木 部長');
  });
});
