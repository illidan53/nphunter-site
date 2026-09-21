import { expect, test } from '@playwright/test';
const homepageUrl = process.env.NPHUNTER_SITE_BASE_URL ?? `file://${process.cwd()}/index.html`;

test('language switch translates the page and persists across reloads', async ({ page }) => {
  await page.goto(homepageUrl);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('heading', { name: '24 点游戏' })).toBeVisible();
  const destinations = await page.locator('.project').evaluateAll(links => links.map(link => link.getAttribute('href')));
  await page.getByRole('combobox', { name: '选择语言' }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Your next discovery' })).toBeVisible();
  await expect(page.locator('.project-status').first()).toHaveText('Unfinished · WIP');
  await expect(page.getByRole('link', { name: 'Play Spring Fields' })).toBeVisible();
  await expect(page).toHaveTitle('nphunter.net — A playground for curiosity');
  expect(await page.locator('body').innerText()).not.toMatch(/半成品|进入游戏|金融工具|好奇心/);
  expect(await page.locator('.project').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(destinations);
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Choose language' })).toHaveValue('en');
  await page.locator('#language').selectOption('zh');
  await expect(page.locator('.project-status').first()).toHaveText('半成品 · 开发中');
  await page.reload();
  await expect(page.locator('#language')).toHaveValue('zh');
});

test('language switching works without browser storage', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage disabled'); };
    Storage.prototype.setItem = () => { throw new Error('Storage disabled'); };
  });
  await page.goto(homepageUrl);
  await page.locator('#language').selectOption('en');
  await expect(page.getByRole('heading', { name: 'Your next discovery' })).toBeVisible();
});
