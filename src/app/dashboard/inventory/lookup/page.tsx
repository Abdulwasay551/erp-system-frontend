"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fadeInUp } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { PackageSearch, ShoppingCart, Truck } from "lucide-react";

interface PurchaseInfo {
  bill_id: number | null;
  bill_number: string | null;
  supplier_name: string | null;
  purchase_price: string | null;
  purchase_date: string | null;
}

interface SaleInfo {
  invoice_id: number | null;
  invoice_number: string | null;
  customer_name: string | null;
  sold_price: string | null;
  sold_date: string | null;
}

interface LookupResult {
  id: number;
  identifier: string | null;
  product_id: number;
  product_name: string;
  product_sku: string;
  status: string;
  status_display: string;
  current_warehouse: string | null;
  purchase: PurchaseInfo | null;
  sale: SaleInfo | null;
}

const STATUS_TONE: Record<string, string> = {
  available: "bg-success-container text-success border-transparent",
  sold: "bg-neutral-status-container text-neutral-status border-transparent",
  returned: "bg-warning-container text-warning border-transparent",
  damaged: "bg-danger-container text-danger border-transparent",
  expired: "bg-danger-container text-danger border-transparent",
  quarantined: "bg-warning-container text-warning border-transparent",
};

export default function ItemLookupPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LookupResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      const data = await api<{ results: LookupResult[]; count: number }>(
        `/api/products/tracking/lookup/?q=${encodeURIComponent(query)}`
      );
      setResults(data.results);
      if (data.count === 0) toast.info("No matching IMEI/serial/barcode found.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Lookup failed.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Item Lookup</h1>
        <p className="text-sm text-muted-foreground">
          Search any IMEI, serial number, barcode, or batch number to see its full purchase and sale history.
        </p>
      </div>

      <Card>
        <CardContent className="flex gap-2 pt-6">
          <Input
            autoFocus
            placeholder="Scan or type an IMEI/serial/barcode..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
          />
          <Button onClick={runSearch} disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </Button>
        </CardContent>
      </Card>

      {searched && !searching && results.length === 0 && (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No matching item found.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {results.map((r) => (
          <motion.div key={r.id} initial="hidden" animate="visible" variants={fadeInUp}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm">
                    {r.product_name} <span className="text-muted-foreground">({r.product_sku})</span>
                  </CardTitle>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{r.identifier}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    STATUS_TONE[r.status] ?? "bg-neutral-status-container text-neutral-status"
                  )}
                >
                  {r.status_display}
                </span>
              </CardHeader>
              <CardContent>
                <Separator className="mb-4" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 rounded-md border p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Truck className="size-3.5" /> Purchase
                    </p>
                    {r.purchase ? (
                      <div className="flex flex-col gap-1 text-sm">
                        <p>
                          <span className="text-muted-foreground">Bill: </span>
                          {r.purchase.bill_number ?? "-"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Supplier: </span>
                          {r.purchase.supplier_name ?? "-"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Price: </span>
                          {r.purchase.purchase_price ? `Rs. ${r.purchase.purchase_price}` : "-"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Date: </span>
                          {r.purchase.purchase_date ?? "-"}
                        </p>
                        {r.current_warehouse && (
                          <p>
                            <span className="text-muted-foreground">Warehouse: </span>
                            {r.current_warehouse}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <PackageSearch className="size-3.5" /> No purchase record on file.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 rounded-md border p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <ShoppingCart className="size-3.5" /> Sale
                    </p>
                    {r.sale ? (
                      <div className="flex flex-col gap-1 text-sm">
                        <p>
                          <span className="text-muted-foreground">Invoice: </span>
                          {r.sale.invoice_number ?? "-"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Customer: </span>
                          {r.sale.customer_name ?? "-"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Price: </span>
                          {r.sale.sold_price ? `Rs. ${r.sale.sold_price}` : "-"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Date: </span>
                          {r.sale.sold_date ?? "-"}
                        </p>
                      </div>
                    ) : (
                      <Badge variant="outline" className="w-fit">
                        Currently in stock
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
