import { expect, test, type Page } from '@playwright/test';

const homepageUrl = process.env.NPHUNTER_SITE_BASE_URL ?? `file://${process.cwd()}/index.html`;
const crownflipUrl = 'https://1gp-game-b83051de5d1f07c4-38xd8px29-1gp-studio.vercel.app/';

// Title of the card resting at the center of the carousel, or null while one is still moving.
function centeredCard(page: Page) {
  return page.evaluate(() => {
    const track = document.getElementById('project-track')!;
    const box = track.getBoundingClientRect();
    for (const slide of track.querySelectorAll('.project')) {
      const rect = slide.getBoundingClientRect();
      if (Math.abs(rect.left + rect.width / 2 - (box.left + box.width / 2)) < 2) return slide.querySelector('h3')!.textContent;
    }
    return null;
  });
}

async function openInEnglish(page: Page) {
  await page.goto(homepageUrl);
  await page.locator('#language').selectOption('en');
}

test('styled is the default look and the arrows bring projects in one at a time', async ({ page }) => {
  await openInEnglish(page);
  await expect(page.locator('html')).toHaveAttribute('data-style', 'styled');
  await expect(page.getByRole('radio', { name: 'Styled' })).toBeChecked();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#060818');

  const dock = page.getByRole('navigation', { name: 'Choose a project' });
  const previous = page.getByRole('button', { name: 'Previous project' });
  const next = page.getByRole('button', { name: 'Next project' });
  await expect(dock.getByRole('button', { name: '24 Points Game' })).toHaveAttribute('aria-current', 'true');
  expect(await centeredCard(page)).toBe('24 Points Game');
  await expect(previous).toHaveAttribute('aria-disabled', 'true');

  for (const title of ['Crownflip', 'Spring Fields', 'Finance Workbench']) {
    await next.click();
    await expect(dock.getByRole('button', { name: title })).toHaveAttribute('aria-current', 'true');
    await expect.poll(() => centeredCard(page)).toBe(title);
  }
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#carousel-status')).toHaveText('Finance Workbench, 4 of 4');
  // A dimmed arrow stays focusable and clickable, but does nothing at the end of the row.
  await next.click({ force: true });
  await expect.poll(() => centeredCard(page)).toBe('Finance Workbench');
  await previous.click();
  await expect.poll(() => centeredCard(page)).toBe('Spring Fields');
});

test('the dock and arrow keys jump straight to a project', async ({ page }) => {
  await openInEnglish(page);
  const dock = page.getByRole('navigation', { name: 'Choose a project' });
  await dock.getByRole('button', { name: 'Spring Fields' }).click();
  await expect.poll(() => centeredCard(page)).toBe('Spring Fields');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => centeredCard(page)).toBe('Crownflip');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => centeredCard(page)).toBe('Finance Workbench');
  await expect(dock.getByRole('button', { name: 'Finance Workbench' })).toHaveAttribute('aria-current', 'true');
});

test('a card off to the side comes to the center before it opens', async ({ page }) => {
  await page.route(`${crownflipUrl}**`, route => route.fulfill({ contentType: 'text/html', body: '<title>Crownflip</title>' }));
  await openInEnglish(page);
  const screen = page.locator('.crown .project-screen');
  const box = (await screen.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => centeredCard(page)).toBe('Crownflip');
  await expect(page).toHaveURL(homepageUrl);

  await screen.click();
  await expect(page).toHaveURL(crownflipUrl);
});

test('keyboard focus brings a card to the center and Enter opens it', async ({ page }) => {
  await page.route(`${crownflipUrl}**`, route => route.fulfill({ contentType: 'text/html', body: '<title>Crownflip</title>' }));
  await openInEnglish(page);
  await page.getByRole('link', { name: 'Play 24 Points Game' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Play Crownflip' })).toBeFocused();
  await expect.poll(() => centeredCard(page)).toBe('Crownflip');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(crownflipUrl);
});

test('the normal look brings back the card grid and is remembered', async ({ page }) => {
  await openInEnglish(page);
  await page.getByRole('radio', { name: 'Normal' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'normal');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#faf9f5');
  await expect(page.getByRole('navigation', { name: 'Choose a project' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Next project' })).toBeHidden();
  const spring = (await page.locator('.spring').boundingBox())!;
  const finance = (await page.locator('.finance').boundingBox())!;
  expect(finance.y).toBe(spring.y);
  expect(finance.x).toBeGreaterThan(spring.x + spring.width);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'normal');
  await expect(page.getByRole('radio', { name: 'Normal' })).toBeChecked();
  await page.getByRole('radio', { name: 'Styled' }).check();
  await page.getByRole('button', { name: 'Next project' }).click();
  await expect.poll(() => centeredCard(page)).toBe('Crownflip');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'styled');
});

test('reduced motion switches cards instantly without ambient animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openInEnglish(page);
  expect(await page.locator('.stars-mid').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await page.getByRole('button', { name: 'Next project' }).click();
  expect(await centeredCard(page)).toBe('Crownflip');
});

test('the styled layout fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(homepageUrl);
  await expect(page.getByRole('radio', { name: '风格化' })).toBeChecked();
  await page.getByRole('button', { name: '下一个项目' }).click();
  await expect.poll(() => centeredCard(page)).toBe('暗冠棋');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/styled-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'test-results/styled-desktop.png' });
});
