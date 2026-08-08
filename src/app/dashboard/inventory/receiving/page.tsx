"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { FilePlus2, PackageOpen, ListOrdered } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { ModuleLinkCard } from "@/components/module-link-card";
import { fadeInUp, staggerContainer } from "@/lib/motion";

interface PendingBill {
  id: number;
}

export default function ReceivingHubPage() {
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    api<PendingBill[]>("/api/purchase/bills/pending-receipt/")
      .then((data) => setPendingCount(data.length))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load pending receipts count."));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Vendor Receiving</h1>
        <p className="text-sm text-muted-foreground">
          Record what a vendor billed you, then confirm what actually showed up at the shop.
        </p>
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <motion.div variants={fadeInUp}>
          <ModuleLinkCard
            href="/dashboard/inventory/receiving/new"
            icon={FilePlus2}
            title="New Vendor Invoice"
            description="Record a bill before goods arrive - stock stays at zero until you receive it."
          />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <ModuleLinkCard
            href="/dashboard/inventory/receiving/pending"
            icon={PackageOpen}
            title="Pending Receipts"
            description="Scan in IMEIs/serials or quantities once goods physically arrive."
            badge={
              pendingCount !== null && pendingCount > 0 ? (
                <Badge className="bg-warning-container text-warning border-transparent">{pendingCount} waiting</Badge>
              ) : undefined
            }
          />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <ModuleLinkCard
            href="/dashboard/inventory/receiving/all"
            icon={ListOrdered}
            title="All Vendor Bills"
            description="Browse every bill on record, received or still pending."
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
