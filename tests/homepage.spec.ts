import { expect, test } from "@playwright/test";

const homepageUrl = process.env.NPHUNTER_SITE_BASE_URL ?? `file://${process.cwd()}/index.html`;

test("homepage exposes all published project entries", async ({ page }) => {
  const response = await page.goto(homepageUrl);
  if (/^https?:/.test(homepageUrl)) {
    // A fresh browser must not receive HTML that it may reuse without validation.
    expect(response?.headers()["cache-control"]).toMatch(/(?:^|,)\s*no-cache(?:,|$)/);
  }

  await expect(page.getByRole("heading", { name: "nphunter.net" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play DarkPath" })).toHaveAttribute(
    "href",
    "https://ggame.nphunter.net"
  );
  await expect(page.getByRole("link", { name: "Play Abyssal Echoes" })).toHaveAttribute(
    "href",
    "https://cgame.nphunter.net"
  );
  await expect(page.getByRole("link", { name: "Play 春野逐鹿" })).toHaveAttribute(
    "href",
    "https://tgame.nphunter.net"
  );
  await expect(page.getByRole("link", { name: "Open Finance Workbench" })).toHaveAttribute(
    "href",
    "https://finance.nphunter.net"
  );

  if (process.env.NPHUNTER_SITE_VERIFY_TARGETS === "1") {
    await page.goto("https://finance.nphunter.net");
    await expect(page).toHaveTitle("Stock Workbench");
    await expect(page.getByRole("heading", { name: "Stock Workbench" })).toBeVisible();
  }
});


test("TGame entry opens the playable game", async ({ page }) => {
  test.skip(process.env.NPHUNTER_SITE_VERIFY_TARGETS !== "1", "Public target verification runs after deployment");
  await page.goto(homepageUrl);
  await page.getByRole("link", { name: "Play 春野逐鹿" }).click();
  await expect(page).toHaveTitle("富甲天下 · 春野逐鹿");
  await expect(page.getByRole("heading", { name: "择一主公，入主春野" })).toBeVisible();
  await expect(page.getByRole("button", { name: "开启新对局" })).toBeEnabled();
  const response = await page.request.get("https://tgame.nphunter.net/healthz");
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toMatchObject({ service: "tgame", status: "ok" });
});
