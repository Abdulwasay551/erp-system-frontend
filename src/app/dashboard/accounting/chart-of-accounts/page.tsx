"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/data-state";
import { LogoLoader } from "@/components/logo-loader";
import { BarChart, type BarChartSeries } from "@/components/charts/bar-chart";
import { DateRangeFilter } from "@/components/date-range-filter";
import { InfoTooltip } from "@/components/info-tooltip";

interface TypeBalance {
  type: string;
  type_display: string;
  total_debit: string;
  total_credit: string;
  balance: string;
}

interface MonthRow {
  month: string;
  balances: Record<string, string>;
}

interface CoaAccount {
  id: number;
  code: string;
  name: string;
  account_type: string;
  balance_side: string;
  is_active: boolean;
}

interface CoaGroup {
  id: number;
  code: string;
  name: string;
  accounts: CoaAccount[];
}

interface CoaCategory {
  id: number;
  code: string;
  name: string;
  groups: CoaGroup[];
}

const TYPE_COLORS: Record<string, string> = {
  asset: "var(--color-chart-1)",
  liability: "var(--color-chart-2)",
  equity: "var(--color-chart-3)",
  income: "var(--color-chart-4)",
  expense: "var(--color-chart-5)",
  contra: "var(--color-chart-1)",
};

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;

export default function ChartOfAccountsPage() {
  const [dateFrom, setDateFrom] = useState(yearStart());
  const [dateTo, setDateTo] = useState(today());
  const [summary, setSummary] = useState<TypeBalance[] | null>(null);
  const [trend, setTrend] = useState<MonthRow[]>([]);
  const [tree, setTree] = useState<CoaCategory[] | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    const range = `date_from=${dateFrom}&date_to=${dateTo}`;
    api<{ types: TypeBalance[] }>(`/api/accounting/accounts/balances_summary/?${range}`)
      .then((r) => setSummary(r.types))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load account balances."))
      .finally(() => setLoading(false));
    api<{ months: MonthRow[] }>(`/api/accounting/accounts/balance_trend/?${range}`)
      .then((r) => setTrend(r.months))
      .catch(() => {});
  }

  useEffect(load, []);

  useEffect(() => {
    api<CoaCategory[]>("/api/accounting/accounts/chart_of_accounts/")
      .then(setTree)
      .catch(() => {});
  }, []);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const usedTypes = summary?.filter((t) => Number(t.total_debit) !== 0 || Number(t.total_credit) !== 0) ?? [];
  const trendSeries: BarChartSeries[] = usedTypes.map((t) => ({
    label: t.type_display,
    color: TYPE_COLORS[t.type] ?? "var(--color-chart-1)",
    data: trend.map((m) => Number(m.balances[t.type] ?? 0)),
  }));

  if (loading && !summary) return <LogoLoader label="Loading chart of accounts..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">Balances by account type, trends over time, and the full account tree.</p>
        </div>
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onApply={load}
          presets={[
            { label: "This month", days: new Date().getDate() },
            { label: "90d", days: 90 },
            { label: "1y", days: 365 },
          ]}
        />
      </div>

      {usedTypes.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {usedTypes.map((t) => {
            const balance = Number(t.balance);
            return (
              <Card key={t.type}>
                <CardContent className="flex flex-col gap-1 p-4">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{t.type_display}</p>
                    <InfoTooltip>
                      Net balance of all {t.type_display.toLowerCase()} accounts from journal activity in the
                      selected date range (credits minus debits for liability/equity/income, debits minus credits
                      for asset/expense - the normal accounting convention for each type).
                    </InfoTooltip>
                  </div>
                  <p className={`text-lg font-semibold ${balance < 0 ? "text-destructive" : ""}`}>
                    Rs. {balance.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {usedTypes.length > 0 && (
        <Card className="animate-in fade-in duration-500">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="size-4 text-primary" /> Balance by Account Type ({dateFrom} to {dateTo})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              categories={usedTypes.map((t) => t.type_display)}
              series={[
                {
                  label: "Balance",
                  color: "var(--color-chart-1)",
                  data: usedTypes.map((t) => Number(t.balance)),
                },
              ]}
              formatValue={(v) => `Rs. ${v.toLocaleString()}`}
            />
          </CardContent>
        </Card>
      )}

      {trend.length > 0 && trendSeries.length > 0 && (
        <Card className="animate-in fade-in duration-500">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="size-4 text-primary" /> Balance Trend by Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              categories={trend.map((m) => m.month)}
              series={trendSeries}
              formatValue={(v) => `Rs. ${v.toLocaleString()}`}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Account Tree</CardTitle>
        </CardHeader>
        <CardContent>
          {!tree ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : tree.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts set up yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {tree.map((category) => (
                <div key={`cat-${category.id}`}>
                  <button
                    onClick={() => toggle(category.id)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-semibold hover:bg-muted"
                  >
                    {expanded.has(category.id) ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    {category.code} &middot; {category.name}
                  </button>
                  {expanded.has(category.id) &&
                    category.groups.map((group) => (
                      <div key={`grp-${group.id}`} className="ml-5">
                        <button
                          onClick={() => toggle(-group.id - 1)}
                          className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm font-medium text-muted-foreground hover:bg-muted"
                        >
                          {expanded.has(-group.id - 1) ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          {group.code} &middot; {group.name}
                        </button>
                        {expanded.has(-group.id - 1) &&
                          group.accounts.map((account) => (
                            <div key={account.id} className="ml-6 flex items-center justify-between px-2 py-1 text-sm">
                              <span>
                                {account.code} &middot; {account.name}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {account.account_type || "-"}
                              </Badge>
                            </div>
                          ))}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
