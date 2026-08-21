"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useIdFromQuery } from "@/lib/use-id-from-query";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DiscountEditor, DiscountEntry } from "@/components/discount-editor";
import { TrackingCodeEditor } from "@/components/tracking-code-editor";
import { LoadingState, ErrorState } from "@/components/data-state";
import { ArrowLeft, Percent, Plus, Trash2 } from "lucide-react";

interface InvoiceDetail {
  id: number;
  invoice_number: string;
  due_date: string | null;
  payment_terms: string;
  notes: string;
  discount_amount: string;
  discount_type: "fixed" | "percent";
  items: {
    id: number;
    product: number;
    product_name: string;
    product_tracking_method: string;
    tracking_unit: number | null;
    tracking_identifier: string | null;
    tracking_status: string | null;
    unit_price: string;
    quantity: string;
    discounts: DiscountEntry[];
  }[];
}

interface EditableItem {
  id?: number;
  product_id: number;
  product_name: string;
  product_tracking_method: string;
  tracking_unit_id: number | null;
  tracking_identifier: string | null;
  tracking_status: string | null;
  unit_price: string;
  quantity: string;
  discounts: DiscountEntry[];
}

interface ProductResult {
  id: number;
  name: string;
  sku: string;
  tracking_method: string;
  selling_price: string;
}

export default function EditInvoicePage() {
  const id = useIdFromQuery();
  const router = useRouter();
  const { user } = useAuth();
  const admin = isAdmin(user);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<EditableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductResult[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api<InvoiceDetail>(`/api/sales/invoices/${id}/`)
      .then((full) => {
        setInvoiceNumber(full.invoice_number);
        setDueDate(full.due_date ?? "");
        setPaymentTerms(full.payment_terms ?? "");
        setNotes(full.notes ?? "");
        setItems(
          full.items.map((it) => ({
            id: it.id,
            product_id: it.product,
            product_name: it.product_name,
            product_tracking_method: it.product_tracking_method,
            tracking_unit_id: it.tracking_unit,
            tracking_identifier: it.tracking_identifier,
            tracking_status: it.tracking_status,
            unit_price: it.unit_price,
            quantity: it.quantity,
            discounts: it.discounts ?? [],
          }))
        );
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load invoice."))
      .finally(() => setLoading(false));
  }, [id]);

  function updateItem(index: number, patch: Partial<EditableItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function searchProducts() {
    if (!productQuery.trim()) return;
    try {
      const data = await api<ProductResult[] | { results: ProductResult[] }>(
        `/api/products/products/?search=${encodeURIComponent(productQuery)}`
      );
      setProductResults(Array.isArray(data) ? data : data.results);
    } catch {
      toast.error("Product search failed.");
    }
  }

  function addItem(p: ProductResult) {
    if (p.tracking_method !== "none") {
      toast.error("Tracked items (IMEI/serial) can't be added here - use POS for new phones.");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        product_id: p.id,
        product_name: p.name,
        product_tracking_method: p.tracking_method,
        tracking_unit_id: null,
        tracking_identifier: null,
        tracking_status: null,
        unit_price: p.selling_price,
        quantity: "1",
        discounts: [],
      },
    ]);
    setProductQuery("");
    setProductResults([]);
  }

  async function save() {
    if (!id) return;
    if (items.length === 0) {
      toast.error("An invoice needs at least one line item.");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/sales/invoices/${id}/edit/`, {
        method: "POST",
        body: JSON.stringify({
          due_date: dueDate || null,
          payment_terms: paymentTerms,
          notes,
          items: items.map((it) => ({
            product_id: it.product_id,
            tracking_id: it.tracking_unit_id ?? undefined,
            quantity: it.tracking_unit_id ? undefined : it.quantity,
            unit_price: it.unit_price,
            discounts: it.discounts.filter((d) => Number(d.value) > 0),
          })),
        }),
      });
      toast.success(`${invoiceNumber} updated.`);
      router.push(`/dashboard/sales/invoices/detail?id=${id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to update invoice.");
    } finally {
      setSaving(false);
    }
  }

  if (!id) return <ErrorState message="No invoice specified - go back and pick one from the list." />;
  if (!admin) return <ErrorState message="Only Owner/Manager can edit an invoice." />;
  if (error) return <ErrorState message={error} />;
  if (loading) return <LoadingState label="Loading invoice..." />;

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/dashboard/sales/invoices/detail?id=${id}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="size-3.5" /> Back to {invoiceNumber}
        </Button>
      </Link>

      <div>
        <h1 className="text-xl font-semibold">Edit Invoice - {invoiceNumber}</h1>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Due Date (optional)</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Payment Terms (optional)</Label>
              <Input placeholder="e.g. Net 30, COD" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <Label>Line Items</Label>
          <div className="flex flex-col gap-2">
            {items.map((it, i) => {
              const activeDiscounts = it.discounts.filter((d) => Number(d.value) > 0);
              return (
                <div key={it.id ?? `new-${i}`} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <span className="flex flex-1 items-center gap-1">
                    {it.product_name}
                    {it.tracking_unit_id && (
                      <span className="ml-1 font-mono text-xs text-muted-foreground">
                        (
                        <TrackingCodeEditor
                          id={it.tracking_unit_id}
                          code={it.tracking_identifier}
                          status={it.tracking_status ?? "sold"}
                          trackingMethod={it.product_tracking_method}
                          onSaved={(newCode) => updateItem(i, { tracking_identifier: newCode })}
                        />
                        )
                      </span>
                    )}
                  </span>
                  <Input
                    className="w-24"
                    placeholder="Price"
                    value={it.unit_price}
                    onChange={(e) => updateItem(i, { unit_price: e.target.value })}
                    inputMode="decimal"
                  />
                  {it.tracking_unit_id ? (
                    <span className="w-16 text-center text-muted-foreground">x1</span>
                  ) : (
                    <Input
                      className="w-16"
                      value={it.quantity}
                      onChange={(e) => updateItem(i, { quantity: e.target.value })}
                      inputMode="decimal"
                    />
                  )}
                  <Dialog>
                    <DialogTrigger
                      render={
                        <Button variant="outline" size="sm">
                          <Percent className="size-3.5" />
                          {activeDiscounts.length > 0 ? activeDiscounts.length : ""}
                        </Button>
                      }
                    />
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Discounts - {it.product_name}</DialogTitle>
                      </DialogHeader>
                      <DiscountEditor value={it.discounts} onChange={(d) => updateItem(i, { discounts: d })} />
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="sm" onClick={() => removeItem(i)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}

            <div className="flex gap-2">
              <Input
                placeholder="Add an untracked product by name..."
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchProducts()}
              />
              <Button type="button" variant="outline" onClick={searchProducts}>
                Search
              </Button>
            </div>
            {productResults.length > 0 && (
              <div className="rounded-md border divide-y">
                {productResults.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{p.name}</span>
                    <Button size="sm" onClick={() => addItem(p)}>
                      <Plus className="size-3.5" /> Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">To add a new phone/IMEI-tracked item, use POS for a new sale instead.</p>
          </div>

          <Button onClick={save} disabled={saving} className="w-fit">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
