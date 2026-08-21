"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { FileText, Receipt, Undo2, Download, Pencil } from "lucide-react";
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

export default function InvoicesPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const router = useRouter();
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
                    className={`cursor-pointer ${highlightId && Number(highlightId) === inv.id ? "bg-primary/10 transition-colors" : ""}`}
                    onClick={() => router.push(`/dashboard/sales/invoices/detail?id=${inv.id}`)}
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
                    <TableCell className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
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
                          <DropdownMenuItem onClick={() => downloadInvoicePdf(inv, "a4")}>A4 invoice (printer)</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {admin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/sales/invoices/edit?id=${inv.id}`)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
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
                                      paymentType === "full" ? "border-primary bg-primary/10 text-primary font-medium" : "hover:bg-accent"
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
                                      paymentType === "partial" ? "border-primary bg-primary/10 text-primary font-medium" : "hover:bg-accent"
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/sales/invoices/return?id=${inv.id}`)}
                      >
                        <Undo2 className="size-3.5" /> Return
                      </Button>
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
