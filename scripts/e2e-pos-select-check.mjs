import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto("http://localhost:3000/login");
  await page.fill("#email", "admin@techcorp.com");
  await page.fill("#password", "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/dashboard");
  await page.click('a[href="/dashboard/pos"]');
  await page.waitForURL("http://localhost:3000/dashboard/pos");
  const text = await page.locator('button:near(:text("Payment method"))').first().textContent();
  console.log("Payment method trigger reads:", JSON.stringify(text));
  await browser.close();
})();
