"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Trophy, TrendingUp } from "lucide-react";
import { ErrorState } from "@/components/data-state";
import { LogoLoader } from "@/components/logo-loader";
import { BarChart } from "@/components/charts/bar-chart";

interface DashboardStats {
  todays_sales_total: string;
  todays_sales_count: number;
  customer_outstanding_total: string;
  supplier_outstanding_total: string;
  low_stock_count: number;
  available_tracked_units: number;
  pending_vendor_receipts: number;
}

interface TopProduct {
  product_id: number;
  product_name: string;
  quantity_sold: string;
  revenue: string;
}

interface LowStockItem {
  product_id: number;
  product_name: string;
  available_quantity: string;
  min_stock: string;
}

interface DayRow {
  date: string;
  revenue: string;
}

function StatCard({
  label,
  value,
  href,
  index,
}: {
  label: string;
  value: string | number;
  href: string;
  index: number;
}) {
  return (
    <Link
      href={href}
      className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
      style={{ animationDelay: `${index * 60}ms`, animationDuration: "400ms" }}
    >
      <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{value}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [trend, setTrend] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api<DashboardStats>("/api/analytics/dashboard/")
      .then(setStats)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load dashboard."))
      .finally(() => setLoading(false));
    api<TopProduct[]>("/api/analytics/top-products/?days=30&limit=5")
      .then(setTopProducts)
      .catch(() => toast.error("Failed to load top products."));
    api<LowStockItem[]>("/api/analytics/low-stock-items/")
      .then(setLowStock)
      .catch(() => toast.error("Failed to load low stock items."));
    api<{ days: DayRow[] }>("/api/analytics/profit-report/?days=7")
      .then((r) => setTrend(r.days))
      .catch(() => {});
  }

  useEffect(load, []);

  if (loading) return <LogoLoader label="Loading dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <StatCard index={0} label="Today's Sales" value={`Rs. ${stats.todays_sales_total}`} href="/dashboard/sales/invoices" />
          <StatCard index={1} label="Today's Sales Count" value={stats.todays_sales_count} href="/dashboard/sales/invoices" />
          <StatCard index={2} label="Customer Outstanding" value={`Rs. ${stats.customer_outstanding_total}`} href="/dashboard/contacts/customers" />
          <StatCard index={3} label="Supplier Outstanding" value={`Rs. ${stats.supplier_outstanding_total}`} href="/dashboard/contacts/suppliers" />
          <StatCard index={4} label="Low Stock Items" value={stats.low_stock_count} href="/dashboard/inventory/products" />
          <StatCard index={5} label="Available Tracked Units" value={stats.available_tracked_units} href="/dashboard/inventory/products" />
          <StatCard index={6} label="Pending Vendor Receipts" value={stats.pending_vendor_receipts} href="/dashboard/inventory/receiving/pending" />
        </div>
      )}

      {trend.length > 0 && (
        <Card className="animate-in fade-in duration-500">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="size-4 text-emerald-600" /> Revenue - Last 7 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              categories={trend.map((d) => d.date.slice(5))}
              series={[{ label: "Revenue", color: "var(--color-chart-1)", data: trend.map((d) => Number(d.revenue)) }]}
              formatValue={(v) => `Rs. ${v.toLocaleString()}`}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="animate-in fade-in duration-500">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="size-4 text-amber-500" /> Top Products (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales in this period yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {topProducts.map((p, i) => (
                  <div key={p.product_id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {i + 1}
                      </span>
                      {p.product_name}
                    </span>
                    <span className="text-muted-foreground">
                      {p.quantity_sold} sold &middot; Rs. {Number(p.revenue).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-in fade-in duration-500">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" /> Low Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing below its reorder point right now.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {lowStock.map((item) => (
                  <div key={item.product_id} className="flex items-center justify-between text-sm">
                    <span>{item.product_name}</span>
                    <Badge variant="destructive">
                      {item.available_quantity} / {item.min_stock}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Link href="/dashboard/accounting/profit" className="text-sm text-primary underline w-fit">
        View full Profit &amp; Loss report &rarr;
      </Link>
    </div>
  );
}
