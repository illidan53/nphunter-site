import { expect, test } from "@playwright/test";

const homepageUrl = process.env.NPHUNTER_SITE_BASE_URL ?? `file://${process.cwd()}/index.html`;
const crownflipUrl = "https://1gp-game-b83051de5d1f07c4-38xd8px29-1gp-studio.vercel.app/";

test("homepage exposes all published project entries", async ({ page }) => {
  const response = await page.goto(homepageUrl);
  await page.locator("#language").selectOption("en");
  if (/^https?:/.test(homepageUrl)) {
    // A fresh browser must not receive HTML that it may reuse without validation.
    expect(response?.headers()["cache-control"]).toMatch(/(?:^|,)\s*no-cache(?:,|$)/);
  }

  await expect(page.getByRole("heading", { name: "nphunter", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play 24 Points Game" })).toHaveAttribute(
    "href",
    "https://1gp-game-1bb7a52890b41f01-q6ozbh23f-1gp-studio.vercel.app/"
  );
  await expect(page.getByRole("link", { name: "Play Crownflip" })).toHaveAttribute("href", crownflipUrl);
  await expect(page.getByRole("link", { name: "Open Finance Workbench" })).toHaveAttribute(
    "href",
    "https://finance.nphunter.net"
  );
  // Unfinished games and the private Spring Fields build are not linked from the hub.
  await expect(page.locator("a.project")).toHaveCount(3);
  await expect(page.locator('a[href*="ggame."], a[href*="cgame."], a[href*="tgame."]')).toHaveCount(0);

  if (process.env.NPHUNTER_SITE_VERIFY_TARGETS === "1") {
    await page.goto(crownflipUrl);
    await expect(page).toHaveTitle("Crownflip 暗冠棋");
    await page.goto("https://finance.nphunter.net");
    await expect(page).toHaveTitle("Stock Workbench");
    await expect(page.getByRole("heading", { name: "Stock Workbench" })).toBeVisible();
  }
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
