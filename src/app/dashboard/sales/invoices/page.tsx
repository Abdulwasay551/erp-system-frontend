"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api, ApiError, openPdf, Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { fadeInUp } from "@/lib/motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/pagination";
import { SortableHead } from "@/components/sortable-head";
import { DeleteButton } from "@/components/delete-button";
import { FileText, Receipt, Undo2, Loader2, Download, Pencil, Percent, Plus, Trash2 } from "lucide-react";
import { DiscountEditor, DiscountEntry } from "@/components/discount-editor";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Invoice {
  id: number;
  invoice_number: string;
  customer: number;
  customer_name: string;
  invoice_date: string;
  due_date: string | null;
  payment_terms: string;
  notes: string;
  total: string;
  paid_amount: string;
  outstanding_amount: string;
  status: string;
  pdf_file: string | null;
}

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

const PAGE_SIZE = 25;

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "credit_card", label: "Credit Card" },
  { value: "online", label: "Online Payment" },
  { value: "other", label: "Other" },
];

const RETURN_REASONS = [
  { value: "return", label: "Product Return" },
  { value: "damage", label: "Damaged Goods" },
  { value: "error", label: "Billing Error" },
  { value: "other", label: "Other" },
];

interface ReturnableItem {
  invoice_item_id: number;
  product_name: string;
  tracking_id: number | null;
  tracking_identifier: string | null;
  unit_price: string;
  returnable_quantity: string;
}

interface InvoiceItemDetail {
  id: number;
  product: number;
  product_name: string;
  tracking_unit: number | null;
  tracking_identifier: string | null;
  quantity: string;
  unit_price: string;
  discounts: DiscountEntry[];
}

interface InvoiceDetail extends Invoice {
  items: InvoiceItemDetail[];
}

interface EditableItem {
  id?: number;
  product_id: number;
  product_name: string;
  tracking_unit_id: number | null;
  tracking_identifier: string | null;
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

export default function InvoicesPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("-invoice_date");
  const [statusFilter, setStatusFilter] = useState("all");

  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paying, setPaying] = useState(false);

  const [downloadingPdfFor, setDownloadingPdfFor] = useState<number | null>(null);

  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  const [returnFor, setReturnFor] = useState<Invoice | null>(null);
  const [returnableItems, setReturnableItems] = useState<ReturnableItem[]>([]);
  const [loadingReturnable, setLoadingReturnable] = useState(false);
  const [selected, setSelected] = useState<Record<number, { checked: boolean; quantity: string }>>({});
  const [returnReason, setReturnReason] = useState("return");
  const [returnNotes, setReturnNotes] = useState("");
  const [processingReturn, setProcessingReturn] = useState(false);

  const [editFor, setEditFor] = useState<Invoice | null>(null);
  const [editDueDate, setEditDueDate] = useState("");
  const [editPaymentTerms, setEditPaymentTerms] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editItems, setEditItems] = useState<EditableItem[]>([]);
  const [loadingEditItems, setLoadingEditItems] = useState(false);
  const [editProductQuery, setEditProductQuery] = useState("");
  const [editProductResults, setEditProductResults] = useState<ProductResult[]>([]);

  function load() {
    const params = new URLSearchParams({ page: String(page), ordering });
    if (statusFilter !== "all") params.set("status", statusFilter);
    api<Paginated<Invoice>>(`/api/sales/invoices/?${params}`)
      .then((data) => {
        setInvoices(data.results);
        setCount(data.count);
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load invoices."));
  }

  useEffect(load, [page, ordering, statusFilter]);

  useEffect(() => {
    if (highlightId && invoices.length > 0) {
      rowRefs.current[Number(highlightId)]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, invoices]);

  function openPay(inv: Invoice) {
    setPayFor(inv);
    setPaymentType("full");
    setAmount(inv.outstanding_amount);
    setReference("");
    setMethod("cash");
  }

  async function openEdit(inv: Invoice) {
    setEditFor(inv);
    setEditDueDate(inv.due_date ?? "");
    setEditPaymentTerms(inv.payment_terms ?? "");
    setEditNotes(inv.notes ?? "");
    setEditItems([]);
    setEditProductQuery("");
    setEditProductResults([]);
    setLoadingEditItems(true);
    try {
      const full = await api<InvoiceDetail>(`/api/sales/invoices/${inv.id}/`);
      setEditItems(
        full.items.map((it) => ({
          id: it.id,
          product_id: it.product,
          product_name: it.product_name,
          tracking_unit_id: it.tracking_unit,
          tracking_identifier: it.tracking_identifier,
          unit_price: it.unit_price,
          quantity: it.quantity,
          discounts: it.discounts ?? [],
        }))
      );
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load invoice items.");
    } finally {
      setLoadingEditItems(false);
    }
  }

  function updateEditItem(index: number, patch: Partial<EditableItem>) {
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
    if (p.tracking_method !== "none") {
      toast.error("Tracked items (IMEI/serial) can't be added here - use POS for new phones.");
      return;
    }
    setEditItems((prev) => [
      ...prev,
      {
        product_id: p.id,
        product_name: p.name,
        tracking_unit_id: null,
        tracking_identifier: null,
        unit_price: p.selling_price,
        quantity: "1",
        discounts: [],
      },
    ]);
    setEditProductQuery("");
    setEditProductResults([]);
  }

  async function saveEdit() {
    if (!editFor) return;
    if (editItems.length === 0) {
      toast.error("An invoice needs at least one line item.");
      return;
    }
    setSavingEdit(true);
    try {
      await api(`/api/sales/invoices/${editFor.id}/edit/`, {
        method: "POST",
        body: JSON.stringify({
          due_date: editDueDate || null,
          payment_terms: editPaymentTerms,
          notes: editNotes,
          items: editItems.map((it) => ({
            product_id: it.product_id,
            tracking_id: it.tracking_unit_id ?? undefined,
            quantity: it.tracking_unit_id ? undefined : it.quantity,
            unit_price: it.unit_price,
            discounts: it.discounts.filter((d) => Number(d.value) > 0),
          })),
        }),
      });
      toast.success(`${editFor.invoice_number} updated.`);
      setEditFor(null);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to update invoice.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function recordPayment() {
    if (!payFor || !amount) {
      toast.error("Enter a payment amount.");
      return;
    }
    setPaying(true);
    try {
      await api("/api/sales/payments/", {
        method: "POST",
        body: JSON.stringify({
          customer: payFor.customer,
          invoice: payFor.id,
          amount,
          method,
          payment_date: new Date().toISOString().slice(0, 10),
          reference: reference || undefined,
        }),
      });
      toast.success(`Payment recorded for ${payFor.invoice_number}.`);
      setPayFor(null);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to record payment.");
    } finally {
      setPaying(false);
    }
  }

  async function downloadInvoicePdf(inv: Invoice, size: "mini" | "a4") {
    setDownloadingPdfFor(inv.id);
    try {
      await openPdf(`/api/sales/invoices/${inv.id}/pdf/?size=${size}`);
    } catch {
      toast.error("Failed to generate invoice PDF.");
    } finally {
      setDownloadingPdfFor(null);
    }
  }

  async function openReturn(inv: Invoice) {
    setReturnFor(inv);
    setReturnReason("return");
    setReturnNotes("");
    setSelected({});
    setLoadingReturnable(true);
    try {
      const items = await api<ReturnableItem[]>(`/api/sales/invoices/${inv.id}/returnable-items/`);
      setReturnableItems(items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load returnable items.");
      setReturnableItems([]);
    } finally {
      setLoadingReturnable(false);
    }
  }

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

  function setSelectedQuantity(invoiceItemId: number, quantity: string) {
    setSelected((prev) => ({ ...prev, [invoiceItemId]: { checked: true, quantity } }));
  }

  async function submitReturn() {
    if (!returnFor) return;
    const items = returnableItems
      .filter((item) => selected[item.invoice_item_id]?.checked)
      .map((item) => ({
        invoice_item_id: item.invoice_item_id,
        tracking_id: item.tracking_id ?? undefined,
        quantity: item.tracking_id ? undefined : selected[item.invoice_item_id]?.quantity,
      }));
    if (items.length === 0) {
      toast.error("Select at least one item to return.");
      return;
    }
    setProcessingReturn(true);
    try {
      const result = await api<{ credit_number: string; total: string }>("/api/sales/returns/process/", {
        method: "POST",
        body: JSON.stringify({
          invoice_id: returnFor.id,
          items,
          reason: returnReason,
          notes: returnNotes || undefined,
        }),
      });
      toast.success(`${result.credit_number} recorded - Rs. ${result.total} refunded to ${returnFor.customer_name}.`);
      setReturnFor(null);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to process return.");
    } finally {
      setProcessingReturn(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Invoices</h1>
          <p className="text-sm text-muted-foreground">All sales invoices and their payment status.</p>
        </div>
        <Select
          items={Object.fromEntries(STATUS_FILTERS.map((s) => [s.value, s.label]))}
          value={statusFilter}
          onValueChange={(v) => {
            if (v) {
              setStatusFilter(v);
              setPage(1);
            }
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead field="invoice_number" ordering={ordering} onSort={setOrdering}>
                  Invoice #
                </SortableHead>
                <TableHead>Customer</TableHead>
                <SortableHead field="invoice_date" ordering={ordering} onSort={setOrdering}>
                  Date
                </SortableHead>
                <SortableHead field="total" ordering={ordering} onSort={setOrdering} className="text-right">
                  Total
                </SortableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="size-6 opacity-50" />
                      <span>No invoices match this filter.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {invoices.map((inv) => (
                <TableRow
                  key={inv.id}
                  ref={(el) => {
                    rowRefs.current[inv.id] = el;
                  }}
                  className={highlightId && Number(highlightId) === inv.id ? "bg-primary/10 transition-colors" : undefined}
                >
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.customer_name}</TableCell>
                  <TableCell>{inv.invoice_date}</TableCell>
                  <TableCell className="text-right">Rs. {inv.total}</TableCell>
                  <TableCell className="text-right">Rs. {inv.paid_amount}</TableCell>
                  <TableCell className="text-right">
                    <span className={Number(inv.outstanding_amount) > 0 ? "font-medium text-warning" : ""}>
                      Rs. {inv.outstanding_amount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={inv.status} />
                  </TableCell>
                  <TableCell className="flex items-center justify-end gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="outline" size="sm" disabled={downloadingPdfFor === inv.id}>
                            <Download className="size-3.5" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => downloadInvoicePdf(inv, "mini")}>
                          Mini receipt (billing machine)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadInvoicePdf(inv, "a4")}>
                          A4 invoice (printer)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {admin && (
                    <Dialog open={editFor?.id === inv.id} onOpenChange={(open) => !open && setEditFor(null)}>
                      <DialogTrigger
                        render={
                          <Button variant="outline" size="sm" onClick={() => openEdit(inv)}>
                            <Pencil className="size-3.5" />
                          </Button>
                        }
                      />
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Edit Invoice - {inv.invoice_number}</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-2">
                              <Label>Due Date (optional)</Label>
                              <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label>Payment Terms (optional)</Label>
                              <Input
                                placeholder="e.g. Net 30, COD"
                                value={editPaymentTerms}
                                onChange={(e) => setEditPaymentTerms(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Notes (optional)</Label>
                            <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                          </div>

                          <Label>Line Items</Label>
                          {loadingEditItems ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                              <Loader2 className="size-4 animate-spin" /> Loading items...
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {editItems.map((it, i) => {
                                const activeDiscounts = it.discounts.filter((d) => Number(d.value) > 0);
                                return (
                                  <div key={it.id ?? `new-${i}`} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                                    <span className="flex-1">
                                      {it.product_name}
                                      {it.tracking_identifier && (
                                        <span className="ml-1 font-mono text-xs text-muted-foreground">
                                          ({it.tracking_identifier})
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
                                    {it.tracking_unit_id ? (
                                      <span className="w-16 text-center text-muted-foreground">x1</span>
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
                                    <Button variant="ghost" size="sm" onClick={() => removeEditItem(i)}>
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </div>
                                );
                              })}

                              <div className="flex gap-2">
                                <Input
                                  placeholder="Add an untracked product by name..."
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
                              <p className="text-xs text-muted-foreground">
                                To add a new phone/IMEI-tracked item, use POS for a new sale instead.
                              </p>
                            </div>
                          )}

                          <Button onClick={saveEdit} disabled={savingEdit || loadingEditItems}>
                            {savingEdit ? "Saving..." : "Save Changes"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    )}
                    {Number(inv.outstanding_amount) > 0 && (
                      <Dialog open={payFor?.id === inv.id} onOpenChange={(open) => !open && setPayFor(null)}>
                        <DialogTrigger
                          render={
                            <Button size="sm" onClick={() => openPay(inv)}>
                              <Receipt className="size-3.5" /> Pay
                            </Button>
                          }
                        />
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Record Payment - {inv.invoice_number}</DialogTitle>
                          </DialogHeader>
                          <div className="flex flex-col gap-3">
                            <p className="text-sm text-muted-foreground">
                              {inv.customer_name} owes Rs. {inv.outstanding_amount} on this invoice.
                            </p>
                            <div className="flex flex-col gap-2">
                              <Label>Payment Amount</Label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPaymentType("full");
                                    setAmount(inv.outstanding_amount);
                                  }}
                                  className={`rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                                    paymentType === "full"
                                      ? "border-primary bg-primary/10 text-primary font-medium"
                                      : "hover:bg-accent"
                                  }`}
                                >
                                  Full Amount
                                  <div className="text-sm font-semibold">Rs. {inv.outstanding_amount}</div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPaymentType("partial");
                                    setAmount("");
                                  }}
                                  className={`rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                                    paymentType === "partial"
                                      ? "border-primary bg-primary/10 text-primary font-medium"
                                      : "hover:bg-accent"
                                  }`}
                                >
                                  Partial Amount
                                  <div className="text-sm font-semibold">Enter below</div>
                                </button>
                              </div>
                              <Input
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                inputMode="decimal"
                                disabled={paymentType === "full"}
                                placeholder={paymentType === "partial" ? "Amount received" : undefined}
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label>Method</Label>
                              <Select
                                items={Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]))}
                                value={method}
                                onValueChange={(v) => v && setMethod(v)}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PAYMENT_METHODS.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                      {m.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label>Reference (optional)</Label>
                              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
                            </div>
                            <Button onClick={recordPayment} disabled={paying}>
                              {paying ? "Recording..." : "Record Payment"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}

                    <Dialog open={returnFor?.id === inv.id} onOpenChange={(open) => !open && setReturnFor(null)}>
                      <DialogTrigger
                        render={
                          <Button variant="outline" size="sm" onClick={() => openReturn(inv)}>
                            <Undo2 className="size-3.5" /> Return
                          </Button>
                        }
                      />
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Process Return - {inv.invoice_number}</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-3">
                          {loadingReturnable ? (
                            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                              <Loader2 className="size-4 animate-spin" /> Loading returnable items...
                            </div>
                          ) : returnableItems.length === 0 ? (
                            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                              Nothing left to return on this invoice.
                            </p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {returnableItems.map((item) => (
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
                                      onChange={(e) => setSelectedQuantity(item.invoice_item_id, e.target.value)}
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
                            <Select
                              items={Object.fromEntries(RETURN_REASONS.map((r) => [r.value, r.label]))}
                              value={returnReason}
                              onValueChange={(v) => v && setReturnReason(v)}
                            >
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
                            <Input value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} />
                          </div>
                          <Button onClick={submitReturn} disabled={processingReturn || returnableItems.length === 0}>
                            {processingReturn ? "Processing..." : "Process Return"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    {admin && (
                      <DeleteButton
                        label={`Invoice ${inv.invoice_number}`}
                        onDelete={() => api(`/api/sales/invoices/${inv.id}/`, { method: "DELETE" })}
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
