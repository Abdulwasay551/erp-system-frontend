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

interface Invoice {
  id: number;
  invoice_number: string;
  customer_name: string;
}

interface ReturnableItem {
  invoice_item_id: number;
  product_name: string;
  tracking_id: number | null;
  tracking_identifier: string | null;
  unit_price: string;
  returnable_quantity: string;
}

const RETURN_REASONS = [
  { value: "return", label: "Product Return" },
  { value: "damage", label: "Damaged Goods" },
  { value: "error", label: "Billing Error" },
  { value: "other", label: "Other" },
];

export default function ReturnInvoicePage() {
  const id = useIdFromQuery();
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<ReturnableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<number, { checked: boolean; quantity: string }>>({});
  const [reason, setReason] = useState("return");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([api<Invoice>(`/api/sales/invoices/${id}/`), api<ReturnableItem[]>(`/api/sales/invoices/${id}/returnable-items/`)])
      .then(([invData, returnable]) => {
        setInvoice(invData);
        setItems(returnable);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load invoice."))
      .finally(() => setLoading(false));
  }, [id]);

  function toggleSelected(item: ReturnableItem) {
    setSelected((prev) => {
      const current = prev[item.invoice_item_id];
      if (current?.checked) {
        const next = { ...prev };
        delete next[item.invoice_item_id];
        return next;
      }
      return { ...prev, [item.invoice_item_id]: { checked: true, quantity: item.returnable_quantity } };
    });
  }

  function selectAll() {
    setSelected(Object.fromEntries(items.map((item) => [item.invoice_item_id, { checked: true, quantity: item.returnable_quantity }])));
  }

  function setQuantity(invoiceItemId: number, quantity: string) {
    setSelected((prev) => ({ ...prev, [invoiceItemId]: { checked: true, quantity } }));
  }

  async function submit() {
    if (!invoice) return;
    const payloadItems = items
      .filter((item) => selected[item.invoice_item_id]?.checked)
      .map((item) => ({
        invoice_item_id: item.invoice_item_id,
        tracking_id: item.tracking_id ?? undefined,
        quantity: item.tracking_id ? undefined : selected[item.invoice_item_id]?.quantity,
      }));
    if (payloadItems.length === 0) {
      toast.error("Select at least one item to return.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<{ credit_number: string; total: string }>("/api/sales/returns/process/", {
        method: "POST",
        body: JSON.stringify({
          invoice_id: invoice.id,
          items: payloadItems,
          reason,
          notes: notes || undefined,
        }),
      });
      toast.success(`${result.credit_number} recorded - Rs. ${result.total} refunded to ${invoice.customer_name}.`);
      router.push(`/dashboard/sales/invoices/detail?id=${invoice.id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to process return.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!id) return <ErrorState message="No invoice specified - go back and pick one from the list." />;
  if (error) return <ErrorState message={error} />;
  if (loading || !invoice) return <LoadingState label="Loading invoice..." />;

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/dashboard/sales/invoices/detail?id=${id}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="size-3.5" /> Back to {invoice.invoice_number}
        </Button>
      </Link>

      <div>
        <h1 className="text-xl font-semibold">Process Return - {invoice.invoice_number}</h1>
        <p className="text-sm text-muted-foreground">{invoice.customer_name}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          {items.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nothing left to return on this invoice.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All (Reverse Whole Invoice)
                </Button>
              </div>
              {items.map((item) => (
                <label
                  key={item.invoice_item_id}
                  className="flex items-center gap-3 rounded-md border p-2.5 text-sm cursor-pointer hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={!!selected[item.invoice_item_id]?.checked}
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
                      value={selected[item.invoice_item_id]?.quantity ?? item.returnable_quantity}
                      onChange={(e) => setQuantity(item.invoice_item_id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={!selected[item.invoice_item_id]?.checked}
                      inputMode="decimal"
                    />
                  )}
                </label>
              ))}
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
