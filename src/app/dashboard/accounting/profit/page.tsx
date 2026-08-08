"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart } from "@/components/charts/bar-chart";
import { TrendingUp, TrendingDown, Wallet, Package, Receipt, CalendarClock, type LucideIcon } from "lucide-react";
import { ErrorState, StatCardSkeletonGrid } from "@/components/data-state";
import { Skeleton } from "@/components/ui/skeleton";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface DayRow {
  date: string;
  revenue: string;
  cogs: string;
  gross_profit: string;
  expenses: string;
  net_profit: string;
}

interface ProfitReport {
  days: DayRow[];
  totals: {
    revenue: string;
    cogs: string;
    gross_profit: string;
    expenses: string;
    net_profit: string;
  };
}

const PERIODS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

function money(v: string | number) {
  const n = Number(v);
  return `Rs. ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}) {
  const color =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
      ? "text-danger"
      : "";
  const badgeColor =
    tone === "positive"
      ? "bg-success-container text-success"
      : tone === "negative"
      ? "bg-danger-container text-danger"
      : "bg-primary/10 text-primary";
  return (
    <Card className="h-full">
      <CardContent className="flex items-center gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", badgeColor)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className={`text-xl font-semibold ${color}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProfitAndLossPage() {
  const [period, setPeriod] = useState("30");
  const [report, setReport] = useState<ProfitReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api<ProfitReport>(`/api/analytics/profit-report/?days=${period}`)
      .then(setReport)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load profit report."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [period]);

  const netProfit = report ? Number(report.totals.net_profit) : 0;
  const today = report && report.days.length > 0 ? report.days[report.days.length - 1] : null;
  const todayNet = today ? Number(today.net_profit) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Profit &amp; Loss</h1>
          <p className="text-sm text-muted-foreground">Revenue minus cost of goods sold minus overhead expenses.</p>
        </div>
        <Select
          items={Object.fromEntries(PERIODS.map((p) => [p.value, p.label]))}
          value={period}
          onValueChange={(v) => v && setPeriod(v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="flex flex-col gap-6">
          <StatCardSkeletonGrid count={5} />
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[220px] w-full" />
            </CardContent>
          </Card>
        </div>
      )}
      {error && <ErrorState message={error} onRetry={load} />}

      {report && (
        <>
          {today && (
            <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
              <Card className="gradient-primary border-none shadow-md">
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
                      <CalendarClock className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm text-primary-foreground/80">Today &middot; {today.date}</p>
                      <p className="text-2xl font-bold sm:text-3xl">{money(today.revenue)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 pl-14 sm:pl-0">
                    <div>
                      <p className="text-xs text-primary-foreground/70">COGS + Expenses</p>
                      <p className="text-base font-semibold">
                        {money(Number(today.cogs) + Number(today.expenses))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-primary-foreground/70">Net Profit</p>
                      <p className="text-base font-semibold flex items-center gap-1">
                        {todayNet >= 0 ? (
                          <TrendingUp className="size-3.5" />
                        ) : (
                          <TrendingDown className="size-3.5" />
                        )}
                        {money(today.net_profit)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="grid grid-cols-2 gap-4 md:grid-cols-5"
          >
            {[
              { label: "Revenue", value: money(report.totals.revenue), tone: undefined, icon: Wallet },
              { label: "Cost of Goods", value: money(report.totals.cogs), tone: undefined, icon: Package },
              {
                label: "Gross Profit",
                value: money(report.totals.gross_profit),
                tone: "positive" as const,
                icon: TrendingUp,
              },
              { label: "Expenses", value: money(report.totals.expenses), tone: undefined, icon: Receipt },
              {
                label: "Net Profit",
                value: money(report.totals.net_profit),
                tone: netProfit >= 0 ? ("positive" as const) : ("negative" as const),
                icon: netProfit >= 0 ? TrendingUp : TrendingDown,
              },
            ].map((s) => (
              <motion.div key={s.label} variants={fadeInUp}>
                <StatCard label={s.label} value={s.value} tone={s.tone} icon={s.icon} />
              </motion.div>
            ))}
          </motion.div>

          <Card className="animate-in fade-in duration-500">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                {netProfit >= 0 ? (
                  <TrendingUp className="size-4 text-success" />
                ) : (
                  <TrendingDown className="size-4 text-danger" />
                )}
                Revenue vs. Costs by day
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart
                categories={report.days.map((d) => d.date.slice(5))}
                series={[
                  { label: "Revenue", color: "#10b981", data: report.days.map((d) => Number(d.revenue)) },
                  {
                    label: "COGS + Expenses",
                    color: "#f87171",
                    data: report.days.map((d) => Number(d.cogs) + Number(d.expenses)),
                  },
                ]}
                formatValue={(v) => `Rs. ${v.toLocaleString()}`}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
