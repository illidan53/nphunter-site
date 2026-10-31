import { expect, test } from '@playwright/test';

const homepageUrl = process.env.NPHUNTER_SITE_BASE_URL ?? `file://${process.cwd()}/index.html`;
// Public entries verified against the creator's AIWANNA profile.
const gameUrls = [
  "7ff06377b930bd306a8b88f7f8ba2157-114f70bb",
  "6ac7b2a01196c3347e0eee1236d4506c-a7760a79",
  "1b933b5d8aad99840d1a074c6e7bd937-894b6aa9",
  "3c60ef6764cb29909fd1599ba3a71520-5e3c2f68",
  "12f22020b083e36dc64124a8fb35ed22-e47fcc2e",
  "self-host-test-game-c8b3994e",
  "dgame-4c17fb47",
  "6c01ca33bf3b16338f966df54528f168-f09563ee",
  "8ffa6bea3b4d8a86fb964aa980cd03a2-b83051de",
  "0c15d8ef57a9e7409a802bdea4b3a884-1bb7a528",
  "minesweper-78b8b1ae"
].map(slug => `https://www.aiwanna.games/games/${slug}`);

test('homepage groups all published AIWANNA games and preserves other project entries', async ({ page }) => {
  if (process.env.NPHUNTER_SITE_VERIFY_TARGETS === '1') test.slow();
  const response = await page.goto(homepageUrl);
  await page.locator('#language').selectOption('en');
  if (/^https?:/.test(homepageUrl)) {
    expect(response?.headers()['cache-control']).toMatch(/(?:^|,)\s*no-cache(?:,|$)/);
  }
  await expect(page.getByRole('heading', { name: 'nphunter', exact: true })).toBeVisible();
  for (const [name, url] of [
    ['Open Finance Workbench', 'https://finance.nphunter.net'],
    ['Open Global Network', 'https://global-network.nphunter.net'],
    ['Open Kube Playground', 'https://k8s-game.nphunter.net'],
  ]) {
    await expect(page.getByRole('link', { name })).toHaveAttribute('href', url);
  }
  await expect(page.locator('.project.kube')).not.toContainText(/Author-only|仅作者/);
  await expect(page.locator('a.project')).toHaveCount(3);
  const trigger = page.getByRole('button', { name: 'Explore games', exact: true });
  await expect(trigger).toBeVisible();
  await expect(page.locator('#games-dialog')).toBeHidden();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Pick your next game' });
  await expect(dialog).toBeVisible();
  const links = dialog.locator('a.game-card');
  await expect(links).toHaveCount(gameUrls.length);
  expect((await links.evaluateAll(elements => elements.map(element => element.getAttribute('href')))).sort()).toEqual([...gameUrls].sort());
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link.locator('h3')).not.toBeEmpty();
    await link.scrollIntoViewIfNeeded();
    await expect.poll(() => link.locator('img').evaluateAll(images => images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  }
  if (process.env.NPHUNTER_SITE_VERIFY_TARGETS === '1') {
    for (const url of gameUrls) {
      const target = await page.request.get(url);
      expect(target.status(), url).toBe(200);
    }
    await page.goto('https://finance.nphunter.net');
    await expect(page).toHaveTitle('Stock Workbench');
    await page.goto('https://global-network.nphunter.net');
    await expect(page).toHaveTitle(/^Net Globe · /);
    const kubeResponse = await page.goto('https://k8s-game.nphunter.net');
    expect(kubeResponse?.status()).toBe(200);
    await expect(page).toHaveTitle('Kube 游乐场');
  }
});

test('game gallery supports keyboard focus, Escape, close, and backdrop dismissal', async ({ page }) => {
  await page.goto(homepageUrl);
  await page.locator('#language').selectOption('en');
  const trigger = page.getByRole('button', { name: 'Explore games', exact: true });
  const dialog = page.locator('#games-dialog');
  const originalOverflow = await page.locator('body').evaluate(element => element.style.overflow);
  await trigger.focus();
  await trigger.press('Enter');
  await expect(dialog).toBeVisible();
  expect(await page.locator('body').evaluate(element => getComputedStyle(element).overflow)).toBe('hidden');
  const stops = await dialog.locator('a, button').count();
  for (let index = 0; index <= stops + 1; index++) {
    await page.keyboard.press('Tab');
    // Native dialogs may visit browser chrome, but never background page controls.
    expect(await dialog.evaluate(element => !document.hasFocus() || element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await page.locator('body').evaluate(element => element.style.overflow)).toBe(originalOverflow);
  await trigger.click();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  // Clicking the visible collection itself is also an entry point.
  await page.locator('.project.games h3').click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('a game card opens its verified AIWANNA page in a new tab', async ({ page, context }) => {
  await context.route('https://www.aiwanna.games/games/**', route => route.fulfill({
    contentType: 'text/html', body: '<title>AIWANNA game</title>',
  }));
  await page.goto(homepageUrl);
  await page.locator('#language').selectOption('en');
  await page.getByRole('button', { name: 'Explore games', exact: true }).click();
  const firstGame = page.locator('#games-dialog a.game-card').first();
  const destination = await firstGame.getAttribute('href');
  const popupPromise = page.waitForEvent('popup');
  await firstGame.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(destination!);
  await expect(page).toHaveURL(homepageUrl);
  await expect(page.locator('#games-dialog')).toBeVisible();
});

test("Spring Fields explains the private Godot project instead of linking out", async ({ page }) => {
  await page.goto(homepageUrl);
  // The page must not name, show or link the original game.
  const published = await page.evaluate(() => document.documentElement.outerHTML + JSON.stringify(window["NPHunterLocales"]));
  expect(published).not.toMatch(/富甲|tgame\./);

  await page.locator("#language").selectOption("en");
  const trigger = page.getByRole("button", { name: "About this project: Spring Fields" });
  const dialog = page.getByRole("dialog", { name: "Spring Fields" });

  await page.getByRole("heading", { name: "Spring Fields" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("a Godot project, not a browser game");
  await expect(dialog).toContainText("decompiling the original program");
  await expect(dialog).toContainText("AI agent watch gameplay videos");
  await expect(dialog).toContainText("isn’t open to the public");
  await expect(dialog.locator("img, video, iframe")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Got it" }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.press("Enter");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.locator("#language").selectOption("zh");
  await page.getByRole("button", { name: "了解项目：春野逐鹿" }).click();
  const zhDialog = page.getByRole("dialog", { name: "春野逐鹿" });
  await expect(zhDialog).toContainText("非浏览器的 Godot 项目");
  await expect(zhDialog).toContainText("涉及原作版权，不对外开放");
  await page.mouse.click(4, 4);
  await expect(zhDialog).toBeHidden();
});
