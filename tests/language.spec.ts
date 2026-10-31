import { expect, test } from '@playwright/test';
const homepageUrl = process.env.NPHUNTER_SITE_BASE_URL ?? `file://${process.cwd()}/index.html`;

test('language switch translates the grid and game gallery and persists across reloads', async ({ page }) => {
  await page.goto(homepageUrl);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('.project.games h3')).toHaveText('游戏');
  const destinations = await page.locator('a.project, a.game-card').evaluateAll(links => links.map(link => link.getAttribute('href')));
  await page.getByRole('combobox', { name: '选择语言' }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.project.games h3')).toHaveText('Games');
  await expect(page.getByRole('button', { name: 'About this project: Spring Fields' })).toBeVisible();
  await expect(page).toHaveTitle('nphunter — A playground for curiosity');
  expect(await page.locator('body').innerText()).not.toMatch(/暗冠棋|春野逐鹿|了解项目|不公开|金融工具|好奇心/);
  expect(await page.locator('a.project, a.game-card').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(destinations);
  await page.getByRole('button', { name: 'Explore games', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Pick your next game' })).toBeVisible();
  expect(await page.locator('#games-dialog').innerText()).not.toMatch(/暗冠棋|妖刀天劫|开始玩/);
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Choose language' })).toHaveValue('en');
  await page.locator('#language').selectOption('zh');
  await page.getByRole('button', { name: '浏览游戏', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '挑一款，开始玩' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('#language')).toHaveValue('zh');
});

test('language and style switching work without browser storage', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('Storage disabled'); };
    Storage.prototype.setItem = () => { throw new Error('Storage disabled'); };
  });
  await page.goto(homepageUrl);
  await page.locator('#language').selectOption('en');
  await expect(page.locator('.project.games h3')).toHaveText('Games');
  await page.getByRole('radio', { name: 'Normal' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'normal');
  await page.getByRole('button', { name: 'Explore games', exact: true }).click();
  await expect(page.locator('#games-dialog')).toBeVisible();
});

test('a missing translation keeps the existing copy instead of blanking it', async ({ page }) => {
  await page.goto(homepageUrl);
  const key = await page.locator('.project.games h3 [data-i18n]').getAttribute('data-i18n');
  expect(key).toBeTruthy();
  await page.evaluate(key => { delete window['NPHunterLocales'].en[key!]; }, key);
  await page.locator('#language').selectOption('en');
  await expect(page.locator('.project.games h3')).toHaveText('游戏');
});
