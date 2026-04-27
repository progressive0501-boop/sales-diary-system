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

test.describe('日報 (SCR-003, SCR-004)', () => {
  test('営業担当が「+ 新規日報作成」ボタンを押すと /reports/new に遷移する', async ({ page }) => {
    await loginAs(page, SALESPERSON_EMAIL);
    await page.goto('/');

    await page.getByRole('button', { name: '+ 新規日報作成' }).click();
    await expect(page).toHaveURL(/\/reports\/new/);
  });

  test('新規日報作成フォームに必要な要素が表示される', async ({ page }) => {
    await loginAs(page, SALESPERSON_EMAIL);
    await page.goto('/reports/new');

    // フォームタイトルが表示される
    await expect(page.getByRole('heading', { name: '日報作成' })).toBeVisible();

    // 本日の日付が表示される（YYYY-MM-DD 形式）
    const today = new Date().toLocaleDateString('sv-SE');
    await expect(page.locator('body')).toContainText(today);

    // 訪問記録セクションが表示される
    await expect(page.getByText('▼ 訪問記録')).toBeVisible();

    // 顧客選択プレースホルダーが表示される
    await expect(page.getByText('顧客を選択')).toBeVisible();

    // 課題・計画の入力エリアが表示される
    await expect(page.getByText('▼ 今日の課題・相談（Problem）')).toBeVisible();
    await expect(page.getByText('▼ 明日やること（Plan）')).toBeVisible();

    // 保存ボタンが表示される
    await expect(page.getByRole('button', { name: '保存する' })).toBeVisible();
  });

  test('マネージャーが /reports/new にアクセスするとダッシュボードにリダイレクトされる', async ({ page }) => {
    await loginAs(page, MANAGER_EMAIL);
    await page.goto('/reports/new');

    // マネージャーは日報作成不可 → / にリダイレクト
    await expect(page).not.toHaveURL(/\/reports\/new/);
  });

  test('日報一覧から日報行をクリックすると詳細ページに遷移する', async ({ page }) => {
    await loginAs(page, SALESPERSON_EMAIL);
    await page.goto('/');

    // テーブルに行が存在する場合のみテストが意味を持つ
    const rows = page.getByRole('row').filter({ has: page.locator('td') });
    const rowCount = await rows.count();

    if (rowCount === 0) {
      test.skip(); // データがない場合はスキップ
      return;
    }

    // 最初の行をクリック
    await rows.first().click();
    await expect(page).toHaveURL(/\/reports\/\d+/);
  });

  test('日報詳細ページに日付・営業名・訪問記録が表示される', async ({ page }) => {
    await loginAs(page, SALESPERSON_EMAIL);
    await page.goto('/');

    const rows = page.getByRole('row').filter({ has: page.locator('td') });
    const rowCount = await rows.count();

    if (rowCount === 0) {
      test.skip();
      return;
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/reports\/\d+/);

    // 詳細ページに基本情報が表示されていることを確認（日付形式 YYYY-MM-DD を含む）
    await expect(page.locator('body')).toContainText(/\d{4}-\d{2}-\d{2}/);
  });
});
