import { chromium } from "playwright";
import path from "node:path";

const SHOT_DIR = path.resolve("./.playwright-screenshots");
const BASE = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (err) => console.log("pageerror:", err.message));
  page.on("response", async (res) => {
    if (res.url().includes("/api/accounting/expenses")) {
      console.log("API response:", res.request().method(), res.url(), res.status());
      try {
        console.log("  body:", (await res.text()).slice(0, 300));
      } catch {}
    }
  });

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

  const inputs = dialog.locator(String.raw`input[data-slot="input"]`);
  console.log("input count in dialog:", await inputs.count());
  await inputs.nth(0).fill("Electricity bill - August"); // Description
  await inputs.nth(1).fill("4500"); // Amount
  await dialog.locator('button:has-text("Save")').click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SHOT_DIR, "34-expense-debug.png") });

  await browser.close();
})().catch((err) => {
  console.error("Add-expense E2E check failed:", err);
  process.exitCode = 1;
});
