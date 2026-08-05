import { chromium } from "playwright";
import path from "node:path";

const SHOT_DIR = path.resolve("./.playwright-screenshots");
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
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOT_DIR, "p4-01-dashboard.png"), fullPage: true });

  await page.goto(`${BASE}/dashboard/accounting`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOT_DIR, "p4-02-accounting-hub.png") });

  await page.goto(`${BASE}/dashboard/accounting/profit`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOT_DIR, "p4-03-profit-loss.png"), fullPage: true });

  await page.goto(`${BASE}/dashboard/settings`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOT_DIR, "p4-04-settings.png") });

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
