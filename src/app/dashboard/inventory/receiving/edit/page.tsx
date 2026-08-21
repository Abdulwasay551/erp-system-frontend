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

interface TrackingUnitSummary {
  id: number;
  code: string | null;
  status: string;
}

interface BillDetail {
  id: number;
  bill_number: string;
  discount_amount: string;
  discount_type: "fixed" | "percent";
  items: {
    id: number;
    product: number;
    product_name: string;
    product_tracking_method: string;
    unit_price: string;
    quantity: string;
    discounts: DiscountEntry[];
    received_quantity: string;
    tracking_units: TrackingUnitSummary[];
  }[];
}

interface EditableBillItem {
  id?: number;
  product_id: number;
  product_name: string;
  product_tracking_method: string;
  unit_price: string;
  quantity: string;
  discounts: DiscountEntry[];
  received_quantity: number;
  tracking_units: TrackingUnitSummary[];
}

interface ProductResult {
  id: number;
  name: string;
  sku: string;
  tracking_method: string;
  cost_price: string;
}

export default function EditBillPage() {
  const id = useIdFromQuery();
  const router = useRouter();
  const { user } = useAuth();
  const admin = isAdmin(user);

  const [billNumber, setBillNumber] = useState("");
  const [items, setItems] = useState<EditableBillItem[]>([]);
  const [headerDiscount, setHeaderDiscount] = useState("");
  const [headerDiscountType, setHeaderDiscountType] = useState<"fixed" | "percent">("fixed");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductResult[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api<BillDetail>(`/api/purchase/bills/${id}/`)
      .then((full) => {
        setBillNumber(full.bill_number);
        setHeaderDiscount(full.discount_amount ?? "");
        setHeaderDiscountType(full.discount_type ?? "fixed");
        setItems(
          full.items.map((it) => ({
            id: it.id,
            product_id: it.product,
            product_name: it.product_name,
            product_tracking_method: it.product_tracking_method,
            unit_price: it.unit_price,
            quantity: it.quantity,
            discounts: it.discounts ?? [],
            received_quantity: Number(it.received_quantity) || 0,
            tracking_units: it.tracking_units ?? [],
          }))
        );
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load bill."))
      .finally(() => setLoading(false));
  }, [id]);

  function updateItem(index: number, patch: Partial<EditableBillItem>) {
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
    setItems((prev) => [
      ...prev,
      {
        product_id: p.id,
        product_name: p.name,
        product_tracking_method: p.tracking_method,
        unit_price: p.cost_price ?? "0",
        quantity: "1",
        discounts: [],
        received_quantity: 0,
        tracking_units: [],
      },
    ]);
    setProductQuery("");
    setProductResults([]);
  }

  async function save() {
    if (!id) return;
    if (items.length === 0) {
      toast.error("A bill needs at least one line item.");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/purchase/bills/${id}/edit/`, {
        method: "POST",
        body: JSON.stringify({
          discount_amount: headerDiscount || undefined,
          discount_type: headerDiscountType,
          items: items.map((it) => ({
            id: it.id,
            product_id: it.product_id,
            unit_price: it.unit_price,
            quantity: it.quantity,
            discounts: it.discounts.filter((d) => Number(d.value) > 0),
          })),
        }),
      });
      toast.success(`${billNumber} updated.`);
      router.push(`/dashboard/inventory/receiving/detail?id=${id}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to update bill.");
    } finally {
      setSaving(false);
    }
  }

  if (!id) return <ErrorState message="No bill specified - go back and pick one from the list." />;
  if (!admin) return <ErrorState message="Only Owner/Manager can edit a vendor bill." />;
  if (error) return <ErrorState message={error} />;
  if (loading) return <LoadingState label="Loading bill..." />;

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/dashboard/inventory/receiving/detail?id=${id}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="size-3.5" /> Back to {billNumber}
        </Button>
      </Link>

      <div>
        <h1 className="text-xl font-semibold">Edit Bill - {billNumber}</h1>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <Label>Line Items</Label>
          <div className="flex flex-col gap-2">
            {items.map((it, i) => {
              const activeDiscounts = it.discounts.filter((d) => Number(d.value) > 0);
              const locked = it.received_quantity > 0;
              return (
                <div key={it.id ?? `new-${i}`} className="flex flex-col gap-1.5 rounded-md border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex-1">
                      {it.product_name}
                      {locked && (
                        <span className="ml-1 text-xs text-muted-foreground">({it.received_quantity} already received)</span>
                      )}
                    </span>
                    <Input
                      className="w-24"
                      placeholder="Price"
                      value={it.unit_price}
                      onChange={(e) => updateItem(i, { unit_price: e.target.value })}
                      inputMode="decimal"
                    />
                    {locked ? (
                      <span className="w-16 text-center text-muted-foreground">x{it.quantity}</span>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={locked}
                      title={locked ? "Can't remove - already received" : undefined}
                      onClick={() => removeItem(i)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  {it.tracking_units.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-1.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Units on this line:</span>
                      {it.tracking_units.map((unit) => (
                        <span key={unit.id} className="font-mono">
                          <TrackingCodeEditor
                            id={unit.id}
                            code={unit.code}
                            status={unit.status}
                            trackingMethod={it.product_tracking_method}
                            onSaved={(newCode) =>
                              updateItem(i, {
                                tracking_units: it.tracking_units.map((u) => (u.id === unit.id ? { ...u, code: newCode } : u)),
                              })
                            }
                          />
                          {unit.status !== "available" && <span className="ml-1 italic">({unit.status})</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex gap-2">
              <Input
                placeholder="Add a product by name..."
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

            <div className="flex items-center justify-end gap-2 pt-2">
              <Label className="text-sm text-muted-foreground">Whole-bill discount</Label>
              <Input
                className="w-28"
                type="number"
                min={0}
                inputMode="decimal"
                value={headerDiscount}
                onChange={(e) => setHeaderDiscount(e.target.value)}
              />
              <div className="flex rounded-md border p-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={headerDiscountType === "fixed" ? "default" : "ghost"}
                  className="h-7 px-2"
                  onClick={() => setHeaderDiscountType("fixed")}
                >
                  Rs.
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={headerDiscountType === "percent" ? "default" : "ghost"}
                  className="h-7 px-2"
                  onClick={() => setHeaderDiscountType("percent")}
                >
                  %
                </Button>
              </div>
            </div>
          </div>

          <Button onClick={save} disabled={saving} className="w-fit">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
