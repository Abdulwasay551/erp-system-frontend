"use client";

import { useEffect, useState } from "react";
import { LineChart, Receipt } from "lucide-react";
import { api } from "@/lib/api";
import { ModuleLinkCard } from "@/components/module-link-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProfitTotals {
  totals: {
    revenue: string;
    net_profit: string;
  };
}

export default function AccountingModulePage() {
  const [totals, setTotals] = useState<ProfitTotals["totals"] | null>(null);

  useEffect(() => {
    api<ProfitTotals>("/api/analytics/profit-report/?days=30")
      .then((data) => setTotals(data.totals))
      .catch(() => {});
  }, []);

  const netProfit = totals ? Number(totals.net_profit) : 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Accounting</h1>

      {totals && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-2 max-w-xl">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">Rs. {Number(totals.revenue).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit (30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-semibold ${netProfit >= 0 ? "text-emerald-600 dark:text-emerald-500" : "text-red-600 dark:text-red-500"}`}>
                Rs. {netProfit.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ModuleLinkCard
          href="/dashboard/accounting/profit"
          icon={LineChart}
          title="Profit & Loss"
          description="Daily revenue, cost of goods, expenses, and net profit"
        />
        <ModuleLinkCard
          href="/dashboard/accounting/expenses"
          icon={Receipt}
          title="Expenses"
          description="Record rent, salaries, utilities, and other overhead"
        />
      </div>
    </div>
  );
}
