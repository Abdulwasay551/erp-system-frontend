"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleLinkCard } from "@/components/module-link-card";

interface Stats {
  todays_sales_total: string;
  todays_sales_count: number;
}

export default function SalesModulePage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api<Stats>("/api/analytics/dashboard/")
      .then(setStats)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load stats."));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Sales</h1>

      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today&apos;s Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">Rs. {stats.todays_sales_total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Transactions Today</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{stats.todays_sales_count}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleLinkCard
          href="/dashboard/sales/pos"
          icon={ShoppingCart}
          title="POS / Sell"
          description="Search or scan products and check out a sale"
        />
      </div>
    </div>
  );
}
