import { chromium } from "playwright";

const BASE = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  page.on("pageerror", (err) => console.log("pageerror:", err.message));

  await page.goto(`${BASE}/login`);
  await page.fill("#email", "admin@techcorp.com");
  await page.fill("#password", "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`);

  await page.goto(`${BASE}/dashboard/settings`);
  await page.waitForTimeout(500);

  const salesmanRow = page.locator("table tbody tr", { hasText: "salesman@techcorp.com" });
  console.log("Salesman row found:", await salesmanRow.count() > 0);
  await salesmanRow.locator('button:has-text("Edit")').click();

  const dialog = page.locator('[role="dialog"]', { hasText: "Edit" });
  await dialog.waitFor({ state: "visible" });

  // Toggle Active -> Inactive
  await dialog.locator('button:has-text("Active")').click();
  await dialog.locator('button:has-text("Save Changes")').click();
  await page.waitForTimeout(1200);

  const afterRow = page.locator("table tbody tr", { hasText: "salesman@techcorp.com" });
  const statusBadge = await afterRow.locator("td").nth(3).innerText();
  console.log("Salesman status after deactivate:", statusBadge.trim());

  // Try to log in as the now-deactivated salesman to confirm it's actually enforced
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "salesman@techcorp.com");
  await page.fill("#password", "salesman123");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  console.log("URL after deactivated login attempt:", page.url());

  await browser.close();
})().catch((err) => {
  console.error("Settings E2E check failed:", err);
  process.exitCode = 1;
});
