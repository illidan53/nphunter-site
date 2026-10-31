import { expect, test, type Page } from '@playwright/test';

const homepageUrl = process.env.NPHUNTER_SITE_BASE_URL ?? `file://${process.cwd()}/index.html`;

async function openInEnglish(page: Page) {
  await page.goto(homepageUrl);
  await page.locator('#language').selectOption('en');
}

async function expectDesktopGrid(page: Page) {
  const games = (await page.locator('.project.games').boundingBox())!;
  const finance = (await page.locator('.project.finance').boundingBox())!;
  const network = (await page.locator('.project.network').boundingBox())!;
  expect(Math.abs(finance.y - network.y)).toBeLessThan(2);
  expect(network.x).toBeGreaterThan(finance.x + finance.width);
  expect(finance.y).toBeGreaterThanOrEqual(games.y + games.height);
  expect(games.width).toBeGreaterThan(finance.width * 1.8);
  expect(games.height).toBeGreaterThan(finance.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('styled defaults to a category grid with a larger visible games collection', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openInEnglish(page);
  await expect(page.locator('html')).toHaveAttribute('data-style', 'styled');
  await expect(page.getByRole('radio', { name: 'Styled' })).toBeChecked();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#060818');
  await expectDesktopGrid(page);
  await expect(page.getByRole('button', { name: 'Explore games', exact: true })).toBeVisible();
  expect(await page.locator('.project.games img:visible').count()).toBeGreaterThan(1);
  await expect(page.getByRole('button', { name: 'Next project' })).toHaveCount(0);
});

test('both interface styles retain the grid and remember the selected style', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openInEnglish(page);
  await page.getByRole('radio', { name: 'Normal' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'normal');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#faf9f5');
  await expectDesktopGrid(page);
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Normal' })).toBeChecked();
  await page.getByRole('button', { name: 'Explore games', exact: true }).click();
  await expect(page.locator('#games-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('radio', { name: 'Styled' }).check();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'styled');
});

test('reduced motion removes ambient animation and keeps the gallery usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openInEnglish(page);
  expect(await page.locator('.stars-mid').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await page.getByRole('button', { name: 'Explore games', exact: true }).click();
  await expect(page.locator('#games-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Explore games', exact: true })).toBeFocused();
});

for (const style of ['styled', 'normal']) {
  test(`${style} layout and gallery fit a small phone and landscape screen`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openInEnglish(page);
    await page.locator(`input[name="site-style"][value="${style}"]`).check();
    const finance = (await page.locator('.project.finance').boundingBox())!;
    const network = (await page.locator('.project.network').boundingBox())!;
    expect(network.y).toBeGreaterThanOrEqual(finance.y + finance.height);
    expect(Math.abs(network.x - finance.x)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Explore games', exact: true }).click();
    const dialog = page.locator('#games-dialog');
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    const lastGame = dialog.locator('.game-card').last();
    await lastGame.scrollIntoViewIfNeeded();
    await expect(lastGame).toBeInViewport();
    await page.screenshot({ path: `test-results/${style}-games-mobile.png` });
    await page.setViewportSize({ width: 812, height: 375 });
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
