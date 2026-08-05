"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PackageCheck, PackageOpen, Plus } from "lucide-react";

interface Warehouse {
  id: number;
  name: string;
}
interface BillItem {
  id: number;
  product_name: string;
  tracking_type: string;
  quantity: string;
  unit_price: string;
}
interface PendingBill {
  id: number;
  bill_number: string;
  supplier_name: string;
  warehouse: number | null;
  warehouse_name: string | null;
  bill_date: string;
  total_amount: string;
  items: BillItem[];
}

export default function PendingReceiptsPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [pending, setPending] = useState<PendingBill[] | null>(null);

  const loadPending = useCallback(() => {
    api<PendingBill[]>("/api/purchase/bills/pending-receipt/")
      .then(setPending)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load pending receipts."));
  }, []);

  useEffect(() => {
    api<Warehouse[]>("/api/inventory/warehouses/")
      .then(setWarehouses)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load warehouses."));
    loadPending();
  }, [loadPending]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pending Receipts</h1>
          <p className="text-sm text-muted-foreground">
            Vendor invoices recorded but not yet physically checked into stock.
          </p>
        </div>
        <Link href="/dashboard/inventory/receiving/new">
          <Button variant="outline">
            <Plus className="size-3.5" /> New Vendor Invoice
          </Button>
        </Link>
      </div>

      {pending === null ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : pending.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <PackageCheck className="size-8 opacity-50" />
            <p className="font-medium text-foreground">All caught up</p>
            <p className="text-sm">No pending vendor invoices - goods already received or none recorded yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {pending.map((bill) => (
            <PendingBillCard key={bill.id} bill={bill} warehouses={warehouses} onDone={loadPending} />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingBillCard({
  bill,
  warehouses,
  onDone,
}: {
  bill: PendingBill;
  warehouses: Warehouse[];
  onDone: () => void;
}) {
  // This shop operates out of one location - always use its warehouse silently rather
  // than making the cashier pick from a list (extra rows here are just leftover generic
  // ERP seed data, not real second locations). Falls back to a picker only if that
  // default warehouse is ever missing.
  const defaultWarehouse = warehouses[0] ?? null;
  const [warehouseId, setWarehouseId] = useState<string>(
    bill.warehouse ? String(bill.warehouse) : defaultWarehouse ? String(defaultWarehouse.id) : ""
  );
  const [codes, setCodes] = useState<Record<number, string>>({});
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function receiveAndComplete() {
    if (!warehouseId) {
      toast.error("Select a receiving warehouse.");
      return;
    }
    setSubmitting(true);
    try {
      const items = bill.items.map((item) => {
        if (item.tracking_type === "none") {
          return { bill_item_id: item.id, quantity: quantities[item.id] || "0" };
        }
        const codeList = (codes[item.id] || "")
          .split("\n")
          .map((c) => c.trim())
          .filter(Boolean);
        return { bill_item_id: item.id, codes: codeList };
      });

      await api(`/api/purchase/bills/${bill.id}/receive-items/`, {
        method: "POST",
        body: JSON.stringify({ warehouse_id: Number(warehouseId), items }),
      });
      await api(`/api/purchase/bills/${bill.id}/confirm-received/`, {
        method: "POST",
        body: JSON.stringify({ receipt_notes: notes || undefined }),
      });
      toast.success(`Bill ${bill.bill_number} marked received.`);
      onDone();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to receive items.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <PackageOpen className="size-4 text-muted-foreground" />
            {bill.bill_number} &middot; {bill.supplier_name}
          </span>
          <span className="text-muted-foreground font-normal">Rs. {bill.total_amount}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!bill.warehouse && !defaultWarehouse && (
          <div className="flex flex-col gap-2 max-w-xs">
            <label className="text-sm font-medium">Receiving warehouse</label>
            <Select
              items={Object.fromEntries(warehouses.map((w) => [String(w.id), w.name]))}
              value={warehouseId}
              onValueChange={(v) => v && setWarehouseId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={String(w.id)}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {bill.items.map((item) => (
          <div key={item.id} className="rounded-md border p-3">
            <p className="text-sm font-medium mb-2">
              {item.product_name} <span className="text-muted-foreground">(expected {item.quantity})</span>{" "}
              {item.tracking_type !== "none" && <Badge variant="outline">{item.tracking_type}</Badge>}
            </p>
            {item.tracking_type === "none" ? (
              <Input
                placeholder="Quantity received"
                value={quantities[item.id] || ""}
                onChange={(e) => setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
                className="max-w-xs"
              />
            ) : (
              <textarea
                className="w-full rounded-md border p-2 text-sm font-mono"
                rows={3}
                placeholder={`Scan/paste ${item.tracking_type} codes, one per line`}
                value={codes[item.id] || ""}
                onChange={(e) => setCodes((prev) => ({ ...prev, [item.id]: e.target.value }))}
              />
            )}
          </div>
        ))}

        <Input
          placeholder="Optional review note"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <Button onClick={receiveAndComplete} disabled={submitting} className="w-fit">
          {submitting ? "Receiving..." : "Receive & Mark Complete"}
        </Button>
      </CardContent>
    </Card>
  );
}
