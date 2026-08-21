"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useIdFromQuery } from "@/lib/use-id-from-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/data-state";
import { StatCard } from "@/components/stat-card";
import { ArrowLeft, DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ProductTrackingUnit {
  id: number;
  imei_number: string | null;
  serial_number: string | null;
  barcode: string | null;
  status: string;
}

interface ProductDetail {
  id: number;
  sku: string;
  name: string;
  brand: string;
  barcode: string | null;
  category_name: string | null;
  tracking_method: string;
  cost_price: string;
  selling_price: string;
  description: string;
  tracking_units: ProductTrackingUnit[];
}

interface ProductHistory {
  product_id: number;
  individually_tracked: boolean;
  purchase_price_history?: { vendor_id: number | null; vendor_name: string | null; date: string | null; price: string | null }[];
  sold_price_history?: { date: string | null; price: string | null; customer_id: number | null; invoice_id: number }[];
  average_cost_history?: unknown[];
  current_average_cost?: string | null;
  current_selling_price?: string;
  profit_to_date: { units_sold: number | string; total_cost: string; total_revenue: string; gross_profit: string };
  vendors: { vendor_id: number | null; vendor_name: string | null; units_supplied: number; last_purchase_date: string | null; avg_price: string | null }[];
}

function money(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  return `Rs. ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function ProductDetailPage() {
  const id = useIdFromQuery();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [history, setHistory] = useState<ProductHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!id) return;
    setError(null);
    setProduct(null);
    setHistory(null);
    Promise.all([
      api<ProductDetail>(`/api/products/products/${id}/`),
      api<ProductHistory>(`/api/products/products/${id}/history/`),
    ])
      .then(([p, h]) => {
        setProduct(p);
        setHistory(h);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? e.message : "Failed to load product.");
        toast.error(e instanceof ApiError ? e.message : "Failed to load product.");
      });
  }

  useEffect(load, [id]);

  if (!id) return <ErrorState message="No product specified - go back and pick one from the catalog." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!product || !history) return <LoadingState label="Loading product..." />;

  const purchaseChartData = (history.purchase_price_history ?? [])
    .filter((p) => p.date && p.price)
    .map((p) => ({ date: p.date!.slice(0, 10), price: Number(p.price), vendor: p.vendor_name }));
  const soldChartData = (history.sold_price_history ?? [])
    .filter((s) => s.date && s.price)
    .map((s) => ({ date: s.date!.slice(0, 10), price: Number(s.price) }));

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dashboard/inventory/products">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="size-3.5" /> Back to Products
        </Button>
      </Link>

      <div>
        <h1 className="text-xl font-semibold">{product.name}</h1>
        <p className="text-sm text-muted-foreground font-mono">{product.sku}</p>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-2 pt-6 text-sm text-muted-foreground md:grid-cols-4">
          <span>
            Brand: <span className="text-foreground">{product.brand || "-"}</span>
          </span>
          <span>
            Category: <span className="text-foreground">{product.category_name || "-"}</span>
          </span>
          <span>
            Cost: <span className="text-foreground">{money(product.cost_price)}</span>
          </span>
          <span>
            Selling: <span className="text-foreground">{money(product.selling_price)}</span>
          </span>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Units Sold" value={String(history.profit_to_date.units_sold)} icon={ShoppingCart} tone="neutral" />
        <StatCard label="Total Cost" value={money(history.profit_to_date.total_cost)} icon={Package} tone="neutral" />
        <StatCard label="Total Revenue" value={money(history.profit_to_date.total_revenue)} icon={DollarSign} tone="neutral" />
        <StatCard
          label="Gross Profit"
          value={money(history.profit_to_date.gross_profit)}
          icon={TrendingUp}
          tone={Number(history.profit_to_date.gross_profit) >= 0 ? "positive" : "negative"}
        />
      </div>

      {history.individually_tracked ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Purchase Price History</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {purchaseChartData.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No purchases recorded yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={purchaseChartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => money(v as number)} labelFormatter={(l, p) => `${l} - ${p?.[0]?.payload?.vendor ?? ""}`} />
                      <Line type="monotone" dataKey="price" stroke="var(--color-primary, #6366f1)" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sold Price History</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {soldChartData.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No sales recorded yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={soldChartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => money(v as number)} />
                      <Line type="monotone" dataKey="price" stroke="var(--color-success, #22c55e)" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Vendors ({history.vendors.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {history.vendors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No purchases recorded for this product yet.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {history.vendors.map((v) => (
                    <div key={v.vendor_id ?? "unknown"} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                      <span className="font-medium">{v.vendor_name ?? "Unknown vendor"}</span>
                      <span className="text-muted-foreground">
                        {v.units_supplied} unit(s) &middot; avg {money(v.avg_price)} &middot; last {v.last_purchase_date ?? "-"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6 text-sm text-muted-foreground">
            <p>
              This product isn&apos;t individually tracked (accessories, cases, chargers) - stock is pooled across vendors, so
              per-unit purchase-price and sourcing history isn&apos;t available. Showing current average cost instead.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <span>
                Current average cost: <span className="text-foreground">{money(history.current_average_cost)}</span>
              </span>
              <span>
                Current selling price: <span className="text-foreground">{money(history.current_selling_price)}</span>
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {product.tracking_method !== "none" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tracking Units ({product.tracking_units.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {product.tracking_units.length === 0 ? (
              <p className="text-sm text-muted-foreground">No units received yet.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {product.tracking_units.map((unit) => (
                  <div key={unit.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span>{unit.imei_number || unit.serial_number || unit.barcode || "-"}</span>
                    {unit.status !== "available" && <Badge variant="outline">{unit.status}</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
