import { chromium } from "playwright";
import path from "node:path";

const SHOT_DIR = path.resolve("./.playwright-screenshots");
const BASE = "http://localhost:3000";

function logErrors(page, label) {
  page.on("pageerror", (err) => console.log(`[${label}] pageerror:`, err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`[${label}] console error:`, msg.text());
  });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  logErrors(page, "main");

  await page.goto(`${BASE}/login`);
  await page.fill("#email", "admin@techcorp.com");
  await page.fill("#password", "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`);
  console.log("Logged in as Owner.");

  // ---------- Suppliers: Add Vendor + search ----------
  await page.goto(`${BASE}/dashboard/contacts/suppliers`);
  await page.click('button:has-text("Add Vendor")');
  const supDialog = page.locator('[role="dialog"]');
  await supDialog.waitFor({ state: "visible" });
  const supInputs = supDialog.locator('input[data-slot="input"]');
  await supInputs.nth(0).fill("E2E Test Vendor"); // name
  await supInputs.nth(1).fill("0301-0000000"); // phone
  await supInputs.nth(2).fill("Karachi"); // city
  await supDialog.locator('button:has-text("Save")').click();
  await page.waitForTimeout(1500);
  const supRow = page.locator("table tbody tr", { hasText: "E2E Test Vendor" });
  console.log("Vendor row visible after add:", await supRow.count() > 0);

  await page.fill('input[placeholder*="Search vendors"]', "E2E Test");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  const rowCount = await page.locator("table tbody tr").count();
  console.log("Rows after searching 'E2E Test':", rowCount);
  await page.screenshot({ path: path.join(SHOT_DIR, "p2-01-suppliers.png") });

  // ---------- Products: Add Product ----------
  await page.goto(`${BASE}/dashboard/inventory/products`);
  await page.click('button:has-text("Add Product")');
  const prodDialog = page.locator('[role="dialog"]');
  await prodDialog.waitFor({ state: "visible" });
  const prodInputs = prodDialog.locator('input[data-slot="input"]');
  await prodInputs.nth(0).fill("E2E Test Accessory"); // name
  await prodInputs.nth(2).fill("E2E-ACC-001"); // sku (index 1 is brand)
  // tracking method defaults to "none" already -> barcode field appears
  await prodDialog.locator('button:has-text("None (quantity-based)")').click();
  const barcodeInput = prodDialog.locator('input[placeholder="Scan or type barcode"]');
  await barcodeInput.fill("9999999999999");
  const priceInputs = prodDialog.locator('input[placeholder="0.00"]');
  await priceInputs.nth(0).fill("5");
  await priceInputs.nth(1).fill("12");
  await prodDialog.locator('button:has-text("Save Product")').click();
  await page.waitForTimeout(1500);
  const prodRow = page.locator("table tbody tr", { hasText: "E2E Test Accessory" });
  console.log("Product row visible after add:", await prodRow.count() > 0);
  await page.screenshot({ path: path.join(SHOT_DIR, "p2-02-products.png") });

  // ---------- Receiving: New Vendor Invoice with searchable supplier combobox ----------
  await page.goto(`${BASE}/dashboard/inventory/receiving/new`);
  const supplierCombo = page.locator('input[placeholder="Search vendors by name..."]');
  await supplierCombo.click();
  await supplierCombo.fill("E2E Test Vendor");
  await page.waitForTimeout(800);
  const supplierOption = page.locator('[role="option"]', { hasText: "E2E Test Vendor" });
  console.log("Supplier combobox option found:", await supplierOption.count() > 0);
  await supplierOption.first().click();

  await page.fill('input[placeholder*="Search by name, SKU"]', "E2E Test Accessory");
  await page.click('button:has-text("Search")');
  await page.waitForTimeout(800);
  await page.click('button:has-text("Add")');
  await page.waitForTimeout(300);

  const lineInputs = page.locator('div.rounded-md.border.p-2 input');
  await lineInputs.nth(0).fill("5"); // unit price
  await lineInputs.nth(1).fill("10"); // expected qty
  await page.screenshot({ path: path.join(SHOT_DIR, "p2-03-new-receipt.png") });

  await page.click('button:has-text("Record Vendor Invoice")');
  await page.waitForTimeout(1500);
  const successCard = page.locator("text=is now waiting to be received");
  console.log("Vendor invoice created (success banner visible):", await successCard.count() > 0);
  await page.screenshot({ path: path.join(SHOT_DIR, "p2-04-invoice-created.png") });

  // ---------- Pending Receipts: warehouse selector should be hidden (only 1 warehouse) ----------
  await page.click('a:has-text("Go to Pending Receipts")');
  await page.waitForURL(`${BASE}/dashboard/inventory/receiving/pending`);
  await page.waitForTimeout(800);
  const warehouseLabel = page.locator('label:has-text("Receiving warehouse")');
  console.log("Warehouse picker hidden (expect 0):", await warehouseLabel.count());

  const billCard = page.locator("text=E2E Test Vendor").locator("xpath=ancestor::*[contains(@class,'gap-3')][1]");
  const qtyInput = page.locator('input[placeholder="Quantity received"]').last();
  await qtyInput.fill("10");
  await page.screenshot({ path: path.join(SHOT_DIR, "p2-05-pending-receipt.png") });
  await page.locator('button:has-text("Receive & Mark Complete")').last().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOT_DIR, "p2-06-received.png") });

  // ---------- POS: searchable customer picker ----------
  await page.goto(`${BASE}/dashboard/sales/pos`);
  await page.fill('input[placeholder*="Scan IMEI"]', "E2E Test Accessory");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  await page.click('table button:has-text("Add")');
  await page.waitForTimeout(300);

  const customerCombo = page.locator('input[placeholder="Walk-in customer"]');
  await customerCombo.click();
  await customerCombo.fill("Ahmed");
  await page.waitForTimeout(800);
  const customerOption = page.locator('[role="option"]', { hasText: "Ahmed" });
  console.log("Customer combobox option found:", await customerOption.count() > 0);
  await customerOption.first().click();
  await page.screenshot({ path: path.join(SHOT_DIR, "p2-07-pos-customer.png") });

  await page.click('button:has-text("Complete Sale")');
  await page.waitForTimeout(1500);
  const invoiceCard = page.locator("text=Last Invoice");
  console.log("POS checkout succeeded:", await invoiceCard.count() > 0);
  await page.screenshot({ path: path.join(SHOT_DIR, "p2-08-pos-done.png") });

  await browser.close();
})().catch((err) => {
  console.error("Phase 2 E2E check failed:", err);
  process.exitCode = 1;
});
