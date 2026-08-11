"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Package, FilePlus2, PackageOpen, History } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModuleLinkCard } from "@/components/module-link-card";

interface Stats {
  low_stock_count: number;
  available_tracked_units: number;
  pending_vendor_receipts: number;
}

export default function InventoryModulePage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api<Stats>("/api/analytics/dashboard/")
      .then(setStats)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load stats."));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Inventory</h1>

      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Items</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{stats.low_stock_count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Available Tracked Units</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{stats.available_tracked_units}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Vendor Receipts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{stats.pending_vendor_receipts}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleLinkCard
          href="/dashboard/inventory/receiving/new"
          icon={FilePlus2}
          title="New Vendor Invoice"
          description="Record a bill before goods physically arrive"
        />
        <ModuleLinkCard
          href="/dashboard/inventory/receiving/pending"
          icon={PackageOpen}
          title="Pending Receipts"
          description="Scan in stock once goods reach the shop"
          badge={
            stats && stats.pending_vendor_receipts > 0 ? (
              <Badge variant="default">{stats.pending_vendor_receipts} waiting</Badge>
            ) : undefined
          }
        />
        <ModuleLinkCard
          href="/dashboard/inventory/receiving/all"
          icon={History}
          title="All Vendor Bills"
          description="Browse past vendor invoices and receipt history"
        />
        <ModuleLinkCard
          href="/dashboard/inventory/products"
          icon={Package}
          title="Products"
          description="Browse and add to your phone & accessory catalog"
        />
      </div>
    </div>
  );
}
