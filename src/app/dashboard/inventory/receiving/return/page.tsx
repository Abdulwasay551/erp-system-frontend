"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useIdFromQuery } from "@/lib/use-id-from-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState, ErrorState } from "@/components/data-state";
import { ArrowLeft } from "lucide-react";

interface Bill {
  id: number;
  bill_number: string;
  supplier_name: string;
  goods_received: boolean;
}

interface BillReturnableItem {
  bill_item_id: number;
  product_name: string;
  tracking_id: number | null;
  tracking_identifier: string | null;
  unit_price: string;
  returnable_quantity: string;
}

const RETURN_REASONS = [
  { value: "return", label: "Stock Return" },
  { value: "damage", label: "Damaged Goods" },
  { value: "wrong_item", label: "Wrong Item Received" },
  { value: "error", label: "Billing Error" },
  { value: "other", label: "Other" },
];

// Tracked bill items can have several tracking units sharing one bill_item_id, so a
// plain bill_item_id key would conflate distinct units - key tracked rows by
// tracking_id instead, falling back to bill_item_id for untracked (qty-based) rows.
const returnKey = (item: BillReturnableItem) => (item.tracking_id ? `t${item.tracking_id}` : `b${item.bill_item_id}`);

export default function ReturnBillPage() {
  const id = useIdFromQuery();
  const router = useRouter();

  const [bill, setBill] = useState<Bill | null>(null);
  const [items, setItems] = useState<BillReturnableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, { checked: boolean; quantity: string }>>({});
  const [reason, setReason] = useState("return");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([api<Bill>(`/api/purchase/bills/${id}/`), api<BillReturnableItem[]>(`/api/purchase/bills/${id}/returnable-items/`)])
      .then(([billData, returnable]) => {
        setBill(billData);
        setItems(returnable);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load bill."))
      .finally(() => setLoading(false));
  }, [id]);

  function toggleSelected(item: BillReturnableItem) {
    const key = returnKey(item);
    setSelected((prev) => {
      const current = prev[key];
      if (current?.checked) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: { checked: true, quantity: item.returnable_quantity } };
    });
  }

  function setQuantity(item: BillReturnableItem, quantity: string) {
    const key = returnKey(item);
    setSelected((prev) => ({ ...prev, [key]: { checked: true, quantity } }));
  }

  function selectAll() {
    const next: Record<string, { checked: boolean; quantity: string }> = {};
    for (const item of items) {
      next[returnKey(item)] = { checked: true, quantity: item.returnable_quantity };
    }
    setSelected(next);
  }

  async function submit() {
    if (!bill) return;
    const payloadItems = items
      .filter((item) => selected[returnKey(item)]?.checked)
      .map((item) => ({
        bill_item_id: item.bill_item_id,
        tracking_id: item.tracking_id ?? undefined,
        quantity: item.tracking_id ? undefined : selected[returnKey(item)]?.quantity,
      }));
    if (payloadItems.length === 0) {
      toast.error("Select at least one item to return.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<{ debit_number: string; total: string }>("/api/purchase/returns/process/", {
        method: "POST",
        body: JSON.stringify({
          bill_id: bill.id,
          items: payloadItems,
          reason,
          notes: notes || undefined,
        }),
      });
      toast.success(`${result.debit_number} recorded - Rs. ${result.total} credited from ${bill.supplier_name}.`);
      router.push(`/dashboard/inventory/receiving/detail?id=${bill.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to process return.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!id) return <ErrorState message="No bill specified - go back and pick one from the list." />;
  if (error) return <ErrorState message={error} />;
  if (loading || !bill) return <LoadingState label="Loading bill..." />;
  if (!bill.goods_received) return <ErrorState message="This bill hasn't been received yet - nothing to return." />;

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/dashboard/inventory/receiving/detail?id=${id}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="size-3.5" /> Back to {bill.bill_number}
        </Button>
      </Link>

      <div>
        <h1 className="text-xl font-semibold">Return to Supplier - {bill.bill_number}</h1>
        <p className="text-sm text-muted-foreground">{bill.supplier_name}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nothing left to return on this bill.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All (Reverse Whole Bill)
                </Button>
              </div>
              {items.map((item) => {
                const key = returnKey(item);
                return (
                  <label
                    key={key}
                    className="flex items-center gap-3 rounded-md border p-2.5 text-sm cursor-pointer hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={!!selected[key]?.checked}
                      onChange={() => toggleSelected(item)}
                      className="size-4"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.tracking_identifier ? `IMEI/Serial: ${item.tracking_identifier}` : `Rs. ${item.unit_price} each`}
                      </p>
                    </div>
                    {!item.tracking_id && (
                      <Input
                        className="w-20"
                        value={selected[key]?.quantity ?? item.returnable_quantity}
                        onChange={(e) => setQuantity(item, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={!selected[key]?.checked}
                        inputMode="decimal"
                      />
                    )}
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Reason</Label>
            <Select items={Object.fromEntries(RETURN_REASONS.map((r) => [r.value, r.label]))} value={reason} onValueChange={(v) => v && setReason(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button onClick={submit} disabled={submitting || items.length === 0} className="w-fit">
            {submitting ? "Processing..." : "Process Return"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
