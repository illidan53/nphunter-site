import { expect, test } from "@playwright/test";

const homepageUrl = process.env.NPHUNTER_SITE_BASE_URL ?? `file://${process.cwd()}/index.html`;

test("homepage exposes project entries including the finance workbench", async ({ page }) => {
  await page.goto(homepageUrl);

  await expect(page.getByRole("heading", { name: "nphunter.net" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play DarkPath" })).toHaveAttribute(
    "href",
    "https://ggame.nphunter.net"
  );
  await expect(page.getByRole("link", { name: "Play Abyssal Echoes" })).toHaveAttribute(
    "href",
    "https://cgame.nphunter.net"
  );
  await expect(page.getByRole("link", { name: "Open Finance Workbench" })).toHaveAttribute(
    "href",
    "https://finance.nphunter.net"
  );
});
