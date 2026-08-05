"use client";

import { useEffect, useState } from "react";
import { FilePlus2, PackageOpen } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { ModuleLinkCard } from "@/components/module-link-card";

interface PendingBill {
  id: number;
}

export default function ReceivingHubPage() {
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    api<PendingBill[]>("/api/purchase/bills/pending-receipt/").then((data) => setPendingCount(data.length)).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Vendor Receiving</h1>
        <p className="text-sm text-muted-foreground">
          Record what a vendor billed you, then confirm what actually showed up at the shop.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ModuleLinkCard
          href="/dashboard/inventory/receiving/new"
          icon={FilePlus2}
          title="New Vendor Invoice"
          description="Record a bill before goods arrive - stock stays at zero until you receive it."
        />
        <ModuleLinkCard
          href="/dashboard/inventory/receiving/pending"
          icon={PackageOpen}
          title="Pending Receipts"
          description="Scan in IMEIs/serials or quantities once goods physically arrive."
          badge={
            pendingCount !== null && pendingCount > 0 ? (
              <Badge variant="default">{pendingCount} waiting</Badge>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
