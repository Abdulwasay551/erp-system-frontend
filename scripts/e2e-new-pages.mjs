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
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("caret-color")) errors.push(`console: ${msg.text()}`);
  });

  await page.goto(`${BASE}/login`);
  await page.fill("#email", "admin@techcorp.com");
  await page.fill("#password", "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`);

  console.log("Invoices page...");
  await page.click('a[href="/dashboard/sales/invoices"]');
  await page.waitForURL(`${BASE}/dashboard/sales/invoices`);
  await page.waitForTimeout(800);
  await shot(page, "30-invoices");

  console.log("Products page...");
  await page.click('a[href="/dashboard/inventory/products"]');
  await page.waitForURL(`${BASE}/dashboard/inventory/products`);
  await page.waitForTimeout(800);
  await shot(page, "31-products");

  console.log("Expenses page...");
  await page.click('a[href="/dashboard/expenses"]');
  await page.waitForURL(`${BASE}/dashboard/expenses`);
  await page.waitForTimeout(800);
  await shot(page, "32-expenses");

  console.log("Settings page...");
  await page.click('a[href="/dashboard/settings"]');
  await page.waitForURL(`${BASE}/dashboard/settings`);
  await page.waitForTimeout(800);
  await shot(page, "33-settings");

  await browser.close();

  if (errors.length) {
    console.log("=== Errors ===");
    errors.forEach((e) => console.log(e));
    process.exitCode = 1;
  } else {
    console.log("No console/page errors.");
  }
})().catch((err) => {
  console.error("New pages E2E check failed:", err);
  process.exitCode = 1;
});
