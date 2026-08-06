"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, openPdf } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Receipt, Undo2, Loader2, Download } from "lucide-react";
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
  total: string;
  paid_amount: string;
  outstanding_amount: string;
  status: string;
  pdf_file: string | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  partially_paid: "secondary",
  sent: "outline",
  draft: "outline",
  overdue: "destructive",
  cancelled: "destructive",
};

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "outstanding", label: "Outstanding" },
  { value: "paid", label: "Paid" },
];

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

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");

  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paying, setPaying] = useState(false);

  const [downloadingPdfFor, setDownloadingPdfFor] = useState<number | null>(null);

  const [returnFor, setReturnFor] = useState<Invoice | null>(null);
  const [returnableItems, setReturnableItems] = useState<ReturnableItem[]>([]);
  const [loadingReturnable, setLoadingReturnable] = useState(false);
  const [selected, setSelected] = useState<Record<number, { checked: boolean; quantity: string }>>({});
  const [returnReason, setReturnReason] = useState("return");
  const [returnNotes, setReturnNotes] = useState("");
  const [processingReturn, setProcessingReturn] = useState(false);

  function load() {
    api<Invoice[]>("/api/sales/invoices/")
      .then(setInvoices)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load invoices."));
  }

  useEffect(load, []);

  function openPay(inv: Invoice) {
    setPayFor(inv);
    setPaymentType("full");
    setAmount(inv.outstanding_amount);
    setReference("");
    setMethod("cash");
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

  async function downloadInvoicePdf(inv: Invoice) {
    setDownloadingPdfFor(inv.id);
    try {
      await openPdf(`/api/sales/invoices/${inv.id}/pdf/`);
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

  const filtered = invoices.filter((inv) => {
    if (statusFilter === "outstanding") return Number(inv.outstanding_amount) > 0;
    if (statusFilter === "paid") return Number(inv.outstanding_amount) <= 0;
    return true;
  });

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
          onValueChange={(v) => v && setStatusFilter(v)}
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

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="size-6 opacity-50" />
                      <span>No invoices match this filter.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.customer_name}</TableCell>
                  <TableCell>{inv.invoice_date}</TableCell>
                  <TableCell className="text-right">Rs. {inv.total}</TableCell>
                  <TableCell className="text-right">Rs. {inv.paid_amount}</TableCell>
                  <TableCell className="text-right">
                    <span className={Number(inv.outstanding_amount) > 0 ? "font-medium text-amber-600 dark:text-amber-500" : ""}>
                      Rs. {inv.outstanding_amount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[inv.status] ?? "outline"}>{inv.status}</Badge>
                  </TableCell>
                  <TableCell className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadInvoicePdf(inv)}
                      disabled={downloadingPdfFor === inv.id}
                    >
                      <Download className="size-3.5" />
                    </Button>
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
