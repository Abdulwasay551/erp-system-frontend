"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SearchableSelect } from "@/components/searchable-select";
import { fadeInUp } from "@/lib/motion";
import { ArrowRight, CheckCircle2, Plus, Trash2 } from "lucide-react";

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
}

export default function NewReceiptPage() {
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<{ value: string; label: string; description?: string }[]>([]);
  const [supplierSearching, setSupplierSearching] = useState(false);

  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [lines, setLines] = useState<NewInvoiceLine[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductResult[]>([]);
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<string | null>(null);

  async function searchSuppliers(q: string) {
    setSupplierSearching(true);
    try {
      const data = await api<Supplier[]>(`/api/purchase/suppliers/?search=${encodeURIComponent(q)}`);
      setSupplierOptions(data.map((s) => ({ value: String(s.id), label: s.name, description: s.city || undefined })));
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
      },
    ]);
    setProductQuery("");
    setProductResults([]);
  }

  function updateLine(key: string, field: "unit_price" | "expected_quantity", value: string) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
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
          })),
        }),
      });
      setLastCreated(resp.bill_number);
      toast.success(`${resp.bill_number} recorded - now pending receipt.`);
      setLines([]);
      setSupplierInvoiceNumber("");
      setSupplierId(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to create invoice.");
    } finally {
      setCreating(false);
    }
  }

  const total = lines.reduce((sum, l) => {
    const price = Number(l.unit_price) || 0;
    const qty = Number(l.expected_quantity) || 0;
    return sum + price * qty;
  }, 0);

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
              {lines.map((l) => (
                <div key={l.key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
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
                  <Button variant="ghost" size="sm" onClick={() => removeLine(l.key)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex justify-end text-sm text-muted-foreground">
                Estimated total: <span className="ml-1 font-medium text-foreground">Rs. {total.toFixed(2)}</span>
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
