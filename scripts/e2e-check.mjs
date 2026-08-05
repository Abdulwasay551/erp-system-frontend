// Manual one-off browser check (not a test-suite file) - drives the real login -> dashboard
// -> POS flow against the locally running dev servers and captures screenshots for review.
import { chromium } from "playwright";
import path from "node:path";

const SHOT_DIR = path.resolve("./.playwright-screenshots");
const BASE = "http://localhost:3000";

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true });
  console.log(`[shot] ${name}`);
}

const errors = [];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));

  console.log("1. Navigate to /login");
  await page.goto(`${BASE}/login`);
  await shot(page, "01-login");

  console.log("2. Fill and submit login form");
  await page.fill("#email", "admin@techcorp.com");
  await page.fill("#password", "admin123");
  await page.click('button[type="submit"]');

  console.log("3. Wait for dashboard redirect");
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 10000 });
  await page.waitForSelector("text=Today's Sales", { timeout: 10000 });
  await shot(page, "02-dashboard");

  console.log("4. Navigate to POS");
  await page.click('a[href="/dashboard/pos"]');
  await page.waitForURL(`${BASE}/dashboard/pos`);
  await shot(page, "03-pos-empty");

  console.log("5. Search for the seeded accessory by name");
  await page.fill('input[placeholder*="Scan IMEI"]', "earbuds");
  await page.click('button:has-text("Search")');
  await page.waitForSelector("table", { timeout: 10000 });
  await shot(page, "04-pos-search-results");

  console.log("6. Add result to cart");
  await page.click('button:has-text("Add")');
  await page.waitForSelector("text=Complete Sale");
  await shot(page, "05-pos-cart");

  console.log("7. Complete the sale (cash)");
  await page.click('button:has-text("Complete Sale")');
  await page.waitForSelector("text=Last Invoice", { timeout: 10000 });
  await shot(page, "06-pos-checkout-success");

  console.log("8. Log out");
  await page.click('button:has-text("Log out")');
  await page.waitForURL(`${BASE}/login`, { timeout: 10000 });
  await shot(page, "07-after-logout");

  await browser.close();

  if (errors.length) {
    console.log("\n=== Console/page errors captured during the run ===");
    errors.forEach((e) => console.log(e));
    process.exitCode = 1;
  } else {
    console.log("\nNo console/page errors captured.");
  }
})().catch((err) => {
  console.error("E2E check failed:", err);
  process.exitCode = 1;
});
