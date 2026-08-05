import { chromium } from "playwright";
import path from "node:path";

const SHOT_DIR = path.resolve("./.playwright-screenshots");
const BASE = "http://localhost:3000";

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
  console.log(`[shot] ${name}`);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (err) => console.log("pageerror:", err.message));

  await page.goto(`${BASE}/login`);
  await page.fill("#email", "admin@techcorp.com");
  await page.fill("#password", "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`);
  await shot(page, "20-overview-expanded");

  console.log("Navigate to Sales module dashboard...");
  await page.click('a[href="/dashboard/sales"]');
  await page.waitForURL(`${BASE}/dashboard/sales`);
  await shot(page, "21-sales-module-dashboard");

  console.log("Navigate to Contacts module dashboard...");
  await page.click('a[href="/dashboard/contacts"]');
  await page.waitForURL(`${BASE}/dashboard/contacts`);
  await shot(page, "22-contacts-module-dashboard");

  console.log("Collapsing sidebar...");
  await page.click('button[aria-label="Collapse sidebar"]');
  await page.waitForTimeout(300);
  await shot(page, "23-sidebar-collapsed");

  console.log("Hovering Contacts module icon to trigger flyout...");
  await page.hover('a[href="/dashboard/contacts"]');
  await page.waitForTimeout(300);
  await shot(page, "24-collapsed-hover-flyout");

  console.log("Expanding sidebar again...");
  await page.click('button[aria-label="Expand sidebar"]');
  await page.waitForTimeout(300);
  await shot(page, "25-sidebar-expanded-again");

  await browser.close();
})().catch((err) => {
  console.error("Sidebar E2E check failed:", err);
  process.exitCode = 1;
});
