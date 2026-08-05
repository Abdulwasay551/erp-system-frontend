"use client";

import { useEffect, useState } from "react";
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
import { TrendingUp, TrendingDown } from "lucide-react";
import { LoadingState, ErrorState } from "@/components/data-state";

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

function money(v: string) {
  const n = Number(v);
  return `Rs. ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const color =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-500"
      : tone === "negative"
      ? "text-red-600 dark:text-red-500"
      : "";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${color}`}>{value}</p>
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

      {loading && <LoadingState label="Loading profit report..." />}
      {error && <ErrorState message={error} onRetry={load} />}

      {report && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <StatCard label="Revenue" value={money(report.totals.revenue)} />
            <StatCard label="Cost of Goods" value={money(report.totals.cogs)} />
            <StatCard label="Gross Profit" value={money(report.totals.gross_profit)} tone="positive" />
            <StatCard label="Expenses" value={money(report.totals.expenses)} />
            <StatCard
              label="Net Profit"
              value={money(report.totals.net_profit)}
              tone={netProfit >= 0 ? "positive" : "negative"}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                {netProfit >= 0 ? (
                  <TrendingUp className="size-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="size-4 text-red-600" />
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
