"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Trophy,
  TrendingUp,
  Wallet,
  Receipt,
  Users,
  Truck,
  Package,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";
import { ErrorState } from "@/components/data-state";
import { LogoLoader } from "@/components/logo-loader";
import { BarChart } from "@/components/charts/bar-chart";
import { cn } from "@/lib/utils";
import { fadeInUp, staggerContainer } from "@/lib/motion";

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

/** The single highest-frequency metric on the page gets the gradient hero treatment -
 * matches why mobile's Dashboard makes today's revenue a gradient hero card. */
function HeroStatCard({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <motion.div variants={fadeInUp} className="col-span-2">
      <Link href={href}>
        <Card className="gradient-primary h-full border-none shadow-md transition-transform hover:-translate-y-0.5">
          <CardContent className="flex items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
              <Wallet className="size-5" />
            </span>
            <div>
              <p className="text-sm text-primary-foreground/80">{label}</p>
              <p className="text-2xl font-bold sm:text-3xl">{value}</p>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  href,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  href: string;
  icon: LucideIcon;
  tone?: "primary" | "warning";
}) {
  return (
    <motion.div variants={fadeInUp}>
      <Link href={href}>
        <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40">
          <CardContent className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                tone === "warning" ? "bg-warning-container text-warning" : "bg-primary/10 text-primary"
              )}
            >
              <Icon className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold">{value}</p>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
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
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
        >
          <HeroStatCard label="Today's Sales" value={`Rs. ${stats.todays_sales_total}`} href="/dashboard/sales/invoices" />
          <StatCard label="Today's Sales Count" value={stats.todays_sales_count} href="/dashboard/sales/invoices" icon={Receipt} />
          <StatCard
            label="Customer Outstanding"
            value={`Rs. ${stats.customer_outstanding_total}`}
            href="/dashboard/contacts/customers"
            icon={Users}
            tone="warning"
          />
          <StatCard
            label="Supplier Outstanding"
            value={`Rs. ${stats.supplier_outstanding_total}`}
            href="/dashboard/contacts/suppliers"
            icon={Truck}
            tone="warning"
          />
          <StatCard
            label="Low Stock Items"
            value={stats.low_stock_count}
            href="/dashboard/inventory/products"
            icon={AlertTriangle}
            tone="warning"
          />
          <StatCard label="Available Tracked Units" value={stats.available_tracked_units} href="/dashboard/inventory/products" icon={Package} />
          <StatCard
            label="Pending Vendor Receipts"
            value={stats.pending_vendor_receipts}
            href="/dashboard/inventory/receiving/pending"
            icon={PackageCheck}
          />
        </motion.div>
      )}

      {trend.length > 0 && (
        <Card className="animate-in fade-in duration-500">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="size-4 text-success" /> Revenue - Last 7 Days
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
              <AlertTriangle className="size-4 text-warning" /> Low Stock
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
