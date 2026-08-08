"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { LineChart, Receipt, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { ModuleLinkCard } from "@/components/module-link-card";
import { Card, CardContent } from "@/components/ui/card";
import { fadeInUp, staggerContainer } from "@/lib/motion";

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
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load profit summary."));
  }, []);

  const netProfit = totals ? Number(totals.net_profit) : 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Accounting</h1>

      {totals && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="grid grid-cols-2 gap-4 max-w-xl"
        >
          <motion.div variants={fadeInUp}>
            <Card className="gradient-primary h-full border-none shadow-md">
              <CardContent className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Wallet className="size-4" />
                </span>
                <div>
                  <p className="text-sm text-primary-foreground/80">Revenue (30 days)</p>
                  <p className="text-xl font-semibold">Rs. {Number(totals.revenue).toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={fadeInUp}>
            <Card className="h-full">
              <CardContent className="flex items-center gap-3">
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                    netProfit >= 0 ? "bg-success-container text-success" : "bg-danger-container text-danger"
                  }`}
                >
                  {netProfit >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                </span>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Net Profit (30 days)</p>
                  <p className={`text-xl font-semibold ${netProfit >= 0 ? "text-success" : "text-danger"}`}>
                    Rs. {netProfit.toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
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
