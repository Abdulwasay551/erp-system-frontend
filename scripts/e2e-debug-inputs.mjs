import { chromium } from "playwright";
const BASE = "http://localhost:3000";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "admin@techcorp.com");
  await page.fill("#password", "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`);
  await page.click('a[href="/dashboard/expenses"]');
  await page.waitForURL(`${BASE}/dashboard/expenses`);
  await page.click('button:has-text("Add Expense")');
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: "visible" });
  const inputs = dialog.locator("input");
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    const html = await inputs.nth(i).evaluate(el => el.outerHTML);
    const visible = await inputs.nth(i).isVisible();
    console.log(i, "visible=", visible, html);
  }
  await browser.close();
})();
