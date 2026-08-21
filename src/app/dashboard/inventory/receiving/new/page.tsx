"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api, ApiError, Paginated } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SearchableSelect } from "@/components/searchable-select";
import { DiscountEditor, DiscountEntry, computeDiscountTotal } from "@/components/discount-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fadeInUp } from "@/lib/motion";
import { ArrowRight, CheckCircle2, Percent, Plus, ScanLine, Trash2 } from "lucide-react";
import { BarcodeScannerDialog } from "@/components/barcode-scanner-dialog";

interface Supplier {
  id: number;
  name: string;
  city: string;
}
interface ProductResult {
  id: number;
  name: string;
  sku: string;
  tracking_method: string;
}
interface NewInvoiceLine {
  key: string;
  product_id: number;
  product_name: string;
  tracking_method: string;
  unit_price: string;
  expected_quantity: string;
  discounts: DiscountEntry[];
  received: boolean;
  codes: string;
}

const IMEI_PATTERN = /^\d{15}$/;

function parseCodes(raw: string): string[] {
  return raw
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);
}

export default function NewReceiptPage() {
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<{ value: string; label: string; description?: string }[]>([]);
  const [supplierSearching, setSupplierSearching] = useState(false);

  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [lines, setLines] = useState<NewInvoiceLine[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductResult[]>([]);
  const [headerDiscount, setHeaderDiscount] = useState("");
  const [headerDiscountType, setHeaderDiscountType] = useState<"fixed" | "percent">("fixed");
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<string | null>(null);
  const [scanningKey, setScanningKey] = useState<string | null>(null);

  async function searchSuppliers(q: string) {
    setSupplierSearching(true);
    try {
      const data = await api<Paginated<Supplier>>(`/api/purchase/suppliers/?search=${encodeURIComponent(q)}`);
      setSupplierOptions(data.results.map((s) => ({ value: String(s.id), label: s.name, description: s.city || undefined })));
    } catch {
      // keep previous options on failure
    } finally {
      setSupplierSearching(false);
    }
  }

  async function searchProducts() {
    if (!productQuery.trim()) return;
    try {
      const data = await api<ProductResult[] | { results: ProductResult[] }>(
        `/api/products/products/?search=${encodeURIComponent(productQuery)}`
      );
      setProductResults(Array.isArray(data) ? data : data.results);
    } catch {
      toast.error("Product search failed.");
    }
  }

  function addLine(p: ProductResult) {
    if (lines.some((l) => l.product_id === p.id)) {
      toast.error(`${p.name} is already on this invoice.`);
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: `${p.id}-${Date.now()}`,
        product_id: p.id,
        product_name: p.name,
        tracking_method: p.tracking_method,
        unit_price: "",
        expected_quantity: p.tracking_method === "none" ? "" : "1",
        discounts: [],
        received: false,
        codes: "",
      },
    ]);
    setProductQuery("");
    setProductResults([]);
  }

  function updateLine(key: string, field: "unit_price" | "expected_quantity", value: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }

  function updateLineDiscounts(key: string, discounts: DiscountEntry[]) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, discounts } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function toggleReceived(key: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, received: !l.received } : l)));
  }

  function setLineCodes(key: string, codes: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, codes } : l)));
  }

  function appendScannedCode(key: string, code: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const existing = parseCodes(l.codes);
        if (existing.includes(code)) {
          toast.info("Code already scanned for this line.");
          return l;
        }
        return { ...l, codes: [...existing, code].join("\n") };
      })
    );
  }

  async function createInvoice() {
    if (!supplierId || lines.length === 0) {
      toast.error("Select a supplier and add at least one line item.");
      return;
    }
    if (lines.some((l) => !l.unit_price || !l.expected_quantity)) {
      toast.error("Enter a unit price and expected quantity for every line.");
      return;
    }
    for (const l of lines) {
      if (!l.received || l.tracking_method === "none") continue;
      const codes = parseCodes(l.codes);
      if (codes.length !== Number(l.expected_quantity)) {
        toast.error(
          `${l.product_name}: marked received now, but ${codes.length} code(s) entered - needs exactly ${l.expected_quantity} to match quantity.`
        );
        return;
      }
      if (l.tracking_method === "imei") {
        const bad = codes.find((c) => !IMEI_PATTERN.test(c));
        if (bad) {
          toast.error(`${l.product_name}: "${bad}" is not a valid IMEI - must be exactly 15 digits.`);
          return;
        }
      }
      if (new Set(codes).size !== codes.length) {
        toast.error(`${l.product_name}: duplicate code entered - each unit needs a unique code.`);
        return;
      }
    }
    setCreating(true);
    try {
      const resp = await api<{ bill_number: string }>("/api/purchase/vendor-invoice/", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: Number(supplierId),
          supplier_invoice_number: supplierInvoiceNumber || undefined,
          items: lines.map((l) => ({
            product_id: l.product_id,
            unit_price: l.unit_price,
            expected_quantity: l.expected_quantity,
            discounts: l.discounts.filter((d) => Number(d.value) > 0),
            received: l.received || undefined,
            codes: l.received && l.tracking_method !== "none" ? parseCodes(l.codes) : undefined,
            received_quantity: l.received && l.tracking_method === "none" ? l.expected_quantity : undefined,
          })),
          discount_amount: Number(headerDiscount) || undefined,
          discount_type: headerDiscountType,
        }),
      });
      setLastCreated(resp.bill_number);
      toast.success(`${resp.bill_number} recorded - now pending receipt.`);
      setLines([]);
      setSupplierInvoiceNumber("");
      setSupplierId(null);
      setHeaderDiscount("");
      setHeaderDiscountType("fixed");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to create invoice.");
    } finally {
      setCreating(false);
    }
  }

  const subtotal = lines.reduce((sum, l) => {
    const price = Number(l.unit_price) || 0;
    const qty = Number(l.expected_quantity) || 0;
    return sum + price * qty;
  }, 0);
  const lineDiscountsTotal = lines.reduce((sum, l) => {
    const price = Number(l.unit_price) || 0;
    const qty = Number(l.expected_quantity) || 0;
    return sum + computeDiscountTotal(price * qty, qty, l.discounts);
  }, 0);
  const netSubtotal = subtotal - lineDiscountsTotal;
  const rawHeaderDiscount = Math.max(Number(headerDiscount) || 0, 0);
  const headerDiscountAmount = Math.min(
    headerDiscountType === "percent" ? netSubtotal * (rawHeaderDiscount / 100) : rawHeaderDiscount,
    netSubtotal
  );
  const total = subtotal - lineDiscountsTotal - headerDiscountAmount;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">New Vendor Invoice</h1>
        <p className="text-sm text-muted-foreground">
          Record a bill before the goods physically arrive. Stock stays at zero until you receive it.
        </p>
      </div>

      {lastCreated && (
        <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
          <Card className="border-success/30 bg-success-container/40">
            <CardContent className="flex items-center justify-between pt-6">
              <p className="flex items-center gap-2 text-sm">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success-container text-success">
                  <CheckCircle2 className="size-4" />
                </span>
                <span>
                  <span className="font-medium">{lastCreated}</span> is now waiting to be received.
                </span>
              </p>
              <Link href="/dashboard/inventory/receiving/pending">
                <Button variant="outline" size="sm">
                  Go to Pending Receipts <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Vendor &amp; Reference</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Supplier</label>
              <SearchableSelect
                value={supplierId}
                onValueChange={setSupplierId}
                options={supplierOptions}
                onSearch={searchSuppliers}
                loading={supplierSearching}
                placeholder="Search vendors by name..."
                emptyText="No vendors match - add one from the Suppliers page."
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Vendor&apos;s invoice number (optional)</label>
              <Input
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                placeholder="e.g. M&P-4521"
              />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Add product</label>
            <div className="flex gap-2">
              <Input
                placeholder="Search by name, SKU, brand..."
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchProducts()}
              />
              <Button type="button" onClick={searchProducts}>
                Search
              </Button>
            </div>
            {productResults.length > 0 && (
              <div className="rounded-md border divide-y">
                {productResults.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      {p.name} <span className="text-muted-foreground">({p.sku})</span>{" "}
                      {p.tracking_method !== "none" && (
                        <Badge variant="outline" className="ml-1">
                          {p.tracking_method}
                        </Badge>
                      )}
                    </span>
                    <Button size="sm" onClick={() => addLine(p)}>
                      <Plus className="size-3.5" /> Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {lines.length > 0 ? (
            <div className="flex flex-col gap-2">
              {lines.map((l) => {
                const activeDiscounts = l.discounts.filter((d) => Number(d.value) > 0);
                const codes = parseCodes(l.codes);
                const expectedCount = Number(l.expected_quantity) || 0;
                return (
                  <div key={l.key} className="flex flex-col gap-2 rounded-md border p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex-1">
                        {l.product_name}{" "}
                        {l.tracking_method !== "none" && (
                          <Badge variant="outline">{l.tracking_method}</Badge>
                        )}
                      </span>
                      <Input
                        className="w-28"
                        placeholder="Unit price"
                        value={l.unit_price}
                        onChange={(e) => updateLine(l.key, "unit_price", e.target.value)}
                        inputMode="decimal"
                      />
                      <Input
                        className="w-28"
                        placeholder="Expected qty"
                        value={l.expected_quantity}
                        onChange={(e) => updateLine(l.key, "expected_quantity", e.target.value)}
                        inputMode="numeric"
                      />
                      <Dialog>
                        <DialogTrigger
                          render={
                            <Button variant="outline" size="sm">
                              <Percent className="size-3.5" />
                              {activeDiscounts.length > 0 ? `${activeDiscounts.length} applied` : "Discount"}
                            </Button>
                          }
                        />
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Discounts - {l.product_name}</DialogTitle>
                          </DialogHeader>
                          <DiscountEditor value={l.discounts} onChange={(d) => updateLineDiscounts(l.key, d)} />
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="sm" onClick={() => removeLine(l.key)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={l.received}
                        onChange={() => toggleReceived(l.key)}
                        className="size-3.5"
                      />
                      Already have these in hand - receive now
                    </label>

                    {l.received && l.tracking_method !== "none" && (
                      <div className="flex flex-col gap-1 rounded-md bg-muted/40 p-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {l.product_name} needs {expectedCount} {l.tracking_method} code(s) -{" "}
                            <span className={codes.length === expectedCount ? "text-success" : ""}>
                              {codes.length} entered
                            </span>
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <textarea
                            className="w-full rounded-md border p-2 text-sm font-mono"
                            rows={2}
                            placeholder={`Scan/paste ${l.tracking_method} codes, one per line`}
                            value={l.codes}
                            onChange={(e) => setLineCodes(l.key, e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            onClick={() => setScanningKey(l.key)}
                            title="Scan with camera"
                          >
                            <ScanLine className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <BarcodeScannerDialog
                open={scanningKey !== null}
                onOpenChange={(open) => !open && setScanningKey(null)}
                onScan={(code) => {
                  if (scanningKey !== null) appendScannedCode(scanningKey, code);
                }}
              />
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Whole-bill discount</Label>
                  <Input
                    className="w-28"
                    type="number"
                    min={0}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={headerDiscount}
                    onChange={(e) => setHeaderDiscount(e.target.value)}
                  />
                  <div className="flex rounded-md border p-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={headerDiscountType === "fixed" ? "default" : "ghost"}
                      className="h-7 px-2"
                      onClick={() => setHeaderDiscountType("fixed")}
                    >
                      Rs.
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={headerDiscountType === "percent" ? "default" : "ghost"}
                      className="h-7 px-2"
                      onClick={() => setHeaderDiscountType("percent")}
                    >
                      %
                    </Button>
                  </div>
                </div>
                {lineDiscountsTotal > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Line discounts: - Rs. {lineDiscountsTotal.toFixed(2)}
                  </div>
                )}
                {headerDiscountAmount > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Whole-bill discount: - Rs. {headerDiscountAmount.toFixed(2)}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  Estimated total: <span className="ml-1 font-medium text-foreground">Rs. {total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              Search and add products above to build this invoice.
            </p>
          )}

          <Button onClick={createInvoice} disabled={creating} className="w-fit gradient-primary border-none">
            {creating ? "Recording..." : "Record Vendor Invoice"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
