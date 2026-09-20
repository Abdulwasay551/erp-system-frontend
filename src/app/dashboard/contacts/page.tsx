"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Building2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleLinkCard } from "@/components/module-link-card";
import { InfoTooltip } from "@/components/info-tooltip";

interface Stats {
  customer_outstanding_total: string;
  supplier_outstanding_total: string;
}

export default function ContactsModulePage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api<Stats>("/api/analytics/dashboard/")
      .then(setStats)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load stats."));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Contacts</h1>

      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                Customer Outstanding
                <InfoTooltip>Total owed to you across all customers: invoices billed, minus payments received and credit notes issued.</InfoTooltip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">Rs. {stats.customer_outstanding_total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                Supplier Outstanding
                <InfoTooltip>Total you owe across all suppliers: bills received, minus payments you made and returns/debit notes issued.</InfoTooltip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">Rs. {stats.supplier_outstanding_total}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleLinkCard
          href="/dashboard/contacts/customers"
          icon={Users}
          title="Customers"
          description="Manage customers and view their ledgers"
        />
        <ModuleLinkCard
          href="/dashboard/contacts/suppliers"
          icon={Building2}
          title="Suppliers"
          description="View vendor ledgers and record payments"
        />
      </div>
    </div>
  );
}
