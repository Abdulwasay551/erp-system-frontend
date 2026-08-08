"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api, ApiError, openPdf, Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { fadeInUp } from "@/lib/motion";
import { Download, PackageSearch, Pencil, Percent, Plus, Trash2, Loader2 } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState, ErrorState } from "@/components/data-state";
import { Pagination } from "@/components/pagination";
import { SortableHead } from "@/components/sortable-head";
import { DeleteButton } from "@/components/delete-button";

interface Bill {
  id: number;
  bill_number: string;
  supplier_name: string;
  bill_date: string;
  status: string;
  goods_received: boolean;
  total_amount: string;
  paid_amount: string;
}

interface BillItemDetail {
  id: number;
  product: number;
  product_name: string;
  quantity: string;
  unit_price: string;
  discounts: DiscountEntry[];
  received_quantity: string;
}

interface BillDetail extends Bill {
  discount_amount: string;
  items: BillItemDetail[];
}

interface EditableBillItem {
  id?: number;
  product_id: number;
  product_name: string;
  unit_price: string;
  quantity: string;
  discounts: DiscountEntry[];
  received_quantity: number;
}

interface ProductResult {
  id: number;
  name: string;
  sku: string;
  tracking_method: string;
  cost_price: string;
}

const PAGE_SIZE = 25;

export default function AllBillsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("-bill_date");
  const [error, setError] = useState<string | null>(null);
  const [downloadingFor, setDownloadingFor] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  const [editFor, setEditFor] = useState<Bill | null>(null);
  const [editItems, setEditItems] = useState<EditableBillItem[]>([]);
  const [editHeaderDiscount, setEditHeaderDiscount] = useState("");
  const [loadingEditItems, setLoadingEditItems] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editProductQuery, setEditProductQuery] = useState("");
  const [editProductResults, setEditProductResults] = useState<ProductResult[]>([]);

  function load() {
    setError(null);
    const params = new URLSearchParams({ page: String(page), ordering });
    api<Paginated<Bill>>(`/api/purchase/bills/?${params}`)
      .then((data) => {
        setBills(data.results);
        setCount(data.count);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load bills."));
  }

  useEffect(load, [page, ordering]);

  useEffect(() => {
    if (highlightId && bills) {
      const el = rowRefs.current[Number(highlightId)];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, bills]);

  async function downloadPdf(bill: Bill) {
    setDownloadingFor(bill.id);
    try {
      await openPdf(`/api/purchase/bills/${bill.id}/pdf/`);
    } catch {
      toast.error("Failed to generate receiving PDF.");
    } finally {
      setDownloadingFor(null);
    }
  }

  async function openEdit(bill: Bill) {
    setEditFor(bill);
    setEditItems([]);
    setEditProductQuery("");
    setEditProductResults([]);
    setLoadingEditItems(true);
    try {
      const full = await api<BillDetail>(`/api/purchase/bills/${bill.id}/`);
      setEditHeaderDiscount(full.discount_amount ?? "");
      setEditItems(
        full.items.map((it) => ({
          id: it.id,
          product_id: it.product,
          product_name: it.product_name,
          unit_price: it.unit_price,
          quantity: it.quantity,
          discounts: it.discounts ?? [],
          received_quantity: Number(it.received_quantity) || 0,
        }))
      );
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load bill items.");
    } finally {
      setLoadingEditItems(false);
    }
  }

  function updateEditItem(index: number, patch: Partial<EditableBillItem>) {
    setEditItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeEditItem(index: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function searchEditProducts() {
    if (!editProductQuery.trim()) return;
    try {
      const data = await api<ProductResult[] | { results: ProductResult[] }>(
        `/api/products/products/?search=${encodeURIComponent(editProductQuery)}`
      );
      setEditProductResults(Array.isArray(data) ? data : data.results);
    } catch {
      toast.error("Product search failed.");
    }
  }

  function addEditItem(p: ProductResult) {
    setEditItems((prev) => [
      ...prev,
      {
        product_id: p.id,
        product_name: p.name,
        unit_price: p.cost_price ?? "0",
        quantity: "1",
        discounts: [],
        received_quantity: 0,
      },
    ]);
    setEditProductQuery("");
    setEditProductResults([]);
  }

  async function saveEdit() {
    if (!editFor) return;
    if (editItems.length === 0) {
      toast.error("A bill needs at least one line item.");
      return;
    }
    setSavingEdit(true);
    try {
      await api(`/api/purchase/bills/${editFor.id}/edit/`, {
        method: "POST",
        body: JSON.stringify({
          discount_amount: editHeaderDiscount || undefined,
          items: editItems.map((it) => ({
            id: it.id,
            product_id: it.product_id,
            unit_price: it.unit_price,
            quantity: it.quantity,
            discounts: it.discounts.filter((d) => Number(d.value) > 0),
          })),
        }),
      });
      toast.success(`${editFor.bill_number} updated.`);
      setEditFor(null);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to update bill.");
    } finally {
      setSavingEdit(false);
    }
  }

  if (bills === null && !error) return <LoadingState label="Loading vendor bills..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Vendor Bills</h1>
        <p className="text-sm text-muted-foreground">Every bill recorded from a supplier, received or still pending.</p>
      </div>

      <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Supplier</TableHead>
                <SortableHead field="bill_date" ordering={ordering} onSort={setOrdering}>
                  Date
                </SortableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
                <SortableHead field="total_amount" ordering={ordering} onSort={setOrdering} className="text-right">
                  Total
                </SortableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <PackageSearch className="size-6 opacity-50" />
                      <span>No vendor bills recorded yet.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {bills?.map((bill) => (
                <TableRow
                  key={bill.id}
                  ref={(el) => {
                    rowRefs.current[bill.id] = el;
                  }}
                  className={highlightId && Number(highlightId) === bill.id ? "bg-primary/10 transition-colors" : undefined}
                >
                  <TableCell className="font-medium">{bill.bill_number}</TableCell>
                  <TableCell>{bill.supplier_name}</TableCell>
                  <TableCell>{bill.bill_date}</TableCell>
                  <TableCell>
                    <StatusBadge status={bill.status} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        bill.goods_received
                          ? "bg-success-container text-success border-transparent"
                          : "bg-warning-container text-warning border-transparent"
                      }
                    >
                      {bill.goods_received ? "Received" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">Rs. {bill.total_amount}</TableCell>
                  <TableCell className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadPdf(bill)}
                      disabled={downloadingFor === bill.id}
                    >
                      <Download className="size-3.5" />
                    </Button>
                    {admin && (
                      <Dialog open={editFor?.id === bill.id} onOpenChange={(open) => !open && setEditFor(null)}>
                        <DialogTrigger
                          render={
                            <Button variant="outline" size="sm" onClick={() => openEdit(bill)}>
                              <Pencil className="size-3.5" />
                            </Button>
                          }
                        />
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Edit Bill - {bill.bill_number}</DialogTitle>
                          </DialogHeader>
                          <div className="flex flex-col gap-3">
                            <Label>Line Items</Label>
                            {loadingEditItems ? (
                              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                                <Loader2 className="size-4 animate-spin" /> Loading items...
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {editItems.map((it, i) => {
                                  const activeDiscounts = it.discounts.filter((d) => Number(d.value) > 0);
                                  const locked = it.received_quantity > 0;
                                  return (
                                    <div key={it.id ?? `new-${i}`} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                                      <span className="flex-1">
                                        {it.product_name}
                                        {locked && (
                                          <span className="ml-1 text-xs text-muted-foreground">
                                            ({it.received_quantity} already received)
                                          </span>
                                        )}
                                      </span>
                                      <Input
                                        className="w-24"
                                        placeholder="Price"
                                        value={it.unit_price}
                                        onChange={(e) => updateEditItem(i, { unit_price: e.target.value })}
                                        inputMode="decimal"
                                      />
                                      {locked ? (
                                        <span className="w-16 text-center text-muted-foreground">x{it.quantity}</span>
                                      ) : (
                                        <Input
                                          className="w-16"
                                          value={it.quantity}
                                          onChange={(e) => updateEditItem(i, { quantity: e.target.value })}
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
                                          <DiscountEditor
                                            value={it.discounts}
                                            onChange={(d) => updateEditItem(i, { discounts: d })}
                                          />
                                        </DialogContent>
                                      </Dialog>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={locked}
                                        title={locked ? "Can't remove - already received" : undefined}
                                        onClick={() => removeEditItem(i)}
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    </div>
                                  );
                                })}

                                <div className="flex gap-2">
                                  <Input
                                    placeholder="Add a product by name..."
                                    value={editProductQuery}
                                    onChange={(e) => setEditProductQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && searchEditProducts()}
                                  />
                                  <Button type="button" variant="outline" onClick={searchEditProducts}>
                                    Search
                                  </Button>
                                </div>
                                {editProductResults.length > 0 && (
                                  <div className="rounded-md border divide-y">
                                    {editProductResults.map((p) => (
                                      <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                                        <span>{p.name}</span>
                                        <Button size="sm" onClick={() => addEditItem(p)}>
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
                                    value={editHeaderDiscount}
                                    onChange={(e) => setEditHeaderDiscount(e.target.value)}
                                  />
                                </div>
                              </div>
                            )}

                            <Button onClick={saveEdit} disabled={savingEdit || loadingEditItems}>
                              {savingEdit ? "Saving..." : "Save Changes"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    {admin && (
                      <DeleteButton
                        label={`Bill ${bill.bill_number}`}
                        onDelete={() => api(`/api/purchase/bills/${bill.id}/`, { method: "DELETE" })}
                        onDeleted={load}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPageChange={setPage} />
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
}
