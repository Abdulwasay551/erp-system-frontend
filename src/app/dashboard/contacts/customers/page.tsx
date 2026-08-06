"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api, ApiError, openPdf } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Receipt, Download, ChevronLeft, ChevronRight } from "lucide-react";
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

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  cnic: string;
  outstanding_balance: string;
}

interface LedgerEntry {
  id: number;
  transaction_date: string;
  reference_type: string;
  reference_id: number;
  description: string;
  debit_amount: string;
  credit_amount: string;
  balance: string;
}

interface LedgerPage {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: LedgerEntry[];
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "credit_card", label: "Credit Card" },
  { value: "online", label: "Online Payment" },
  { value: "other", label: "Other" },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [ledgerFor, setLedgerFor] = useState<Customer | null>(null);
  const [ledger, setLedger] = useState<LedgerPage | null>(null);
  const [ledgerDateFrom, setLedgerDateFrom] = useState("");
  const [ledgerDateTo, setLedgerDateTo] = useState("");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [downloadingLedgerPdf, setDownloadingLedgerPdf] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cnic, setCnic] = useState("");
  const [saving, setSaving] = useState(false);

  const [payFor, setPayFor] = useState<Customer | null>(null);
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paying, setPaying] = useState(false);

  function loadCustomers(q?: string) {
    const qs = q ? `?search=${encodeURIComponent(q)}` : "";
    api<Customer[]>(`/api/crm/customers/${qs}`)
      .then(setCustomers)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load customers."));
  }

  useEffect(loadCustomers, []);

  function ledgerQuery(page: number) {
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (ledgerDateFrom) params.set("date_from", ledgerDateFrom);
    if (ledgerDateTo) params.set("date_to", ledgerDateTo);
    return params.toString();
  }

  async function loadLedgerPage(customer: Customer, page: number) {
    setLedgerLoading(true);
    try {
      const data = await api<LedgerPage>(`/api/crm/customers/${customer.id}/ledger/?${ledgerQuery(page)}`);
      setLedger(data);
      setLedgerPage(page);
    } catch {
      toast.error("Failed to load ledger.");
    } finally {
      setLedgerLoading(false);
    }
  }

  function viewLedger(customer: Customer) {
    setLedgerFor(customer);
    setLedgerDateFrom("");
    setLedgerDateTo("");
    setLedger(null);
    loadLedgerPage(customer, 1);
  }

  async function downloadLedgerPdf() {
    if (!ledgerFor) return;
    setDownloadingLedgerPdf(true);
    try {
      const params = new URLSearchParams();
      if (ledgerDateFrom) params.set("date_from", ledgerDateFrom);
      if (ledgerDateTo) params.set("date_to", ledgerDateTo);
      await openPdf(`/api/crm/customers/${ledgerFor.id}/ledger/pdf/?${params.toString()}`);
    } catch {
      toast.error("Failed to generate ledger PDF.");
    } finally {
      setDownloadingLedgerPdf(false);
    }
  }

  async function addCustomer() {
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/crm/customers/", {
        method: "POST",
        body: JSON.stringify({ name, phone, email, cnic }),
      });
      toast.success("Customer added.");
      setName("");
      setPhone("");
      setEmail("");
      setCnic("");
      setAddOpen(false);
      loadCustomers(search);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to add customer.");
    } finally {
      setSaving(false);
    }
  }

  function openPay(customer: Customer) {
    const hasOutstanding = Number(customer.outstanding_balance) > 0;
    setPayFor(customer);
    setPaymentType(hasOutstanding ? "full" : "partial");
    setAmount(hasOutstanding ? customer.outstanding_balance : "");
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
          customer: payFor.id,
          amount,
          method,
          payment_date: new Date().toISOString().slice(0, 10),
          reference: reference || undefined,
        }),
      });
      toast.success(`Payment recorded for ${payFor.name}.`);
      setPayFor(null);
      loadCustomers(search);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to record payment.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">People and businesses you sell to.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button>Add Customer</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Customer</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Phone (optional)</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Email (optional)</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>CNIC (optional)</Label>
                <Input value={cnic} onChange={(e) => setCnic(e.target.value)} />
              </div>
              <Button onClick={addCustomer} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder="Search customers by name, phone, CNIC..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && loadCustomers(search)}
        className="max-w-sm"
      />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>CNIC</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="size-6 opacity-50" />
                      <span>No customers yet - add one, or they&apos;ll be created automatically at checkout.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone || "-"}</TableCell>
                  <TableCell>{c.cnic || "-"}</TableCell>
                  <TableCell className="text-right">
                    <span className={Number(c.outstanding_balance) > 0 ? "font-medium text-amber-600 dark:text-amber-500" : ""}>
                      Rs. {c.outstanding_balance}
                    </span>
                  </TableCell>
                  <TableCell className="flex gap-2 justify-end">
                    <Dialog
                      open={ledgerFor?.id === c.id}
                      onOpenChange={(open) => !open && setLedgerFor(null)}
                    >
                      <DialogTrigger
                        render={
                          <Button variant="outline" size="sm" onClick={() => viewLedger(c)}>
                            Ledger
                          </Button>
                        }
                      />
                      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{c.name} - Ledger</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs">From</Label>
                            <Input
                              type="date"
                              value={ledgerDateFrom}
                              onChange={(e) => setLedgerDateFrom(e.target.value)}
                              className="h-8 w-36"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label className="text-xs">To</Label>
                            <Input
                              type="date"
                              value={ledgerDateTo}
                              onChange={(e) => setLedgerDateTo(e.target.value)}
                              className="h-8 w-36"
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => ledgerFor && loadLedgerPage(ledgerFor, 1)}
                            disabled={ledgerLoading}
                          >
                            Apply Filter
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-auto"
                            onClick={downloadLedgerPdf}
                            disabled={downloadingLedgerPdf}
                          >
                            <Download className="size-3.5" /> {downloadingLedgerPdf ? "Generating..." : "Download PDF"}
                          </Button>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ref</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right">Debit</TableHead>
                              <TableHead className="text-right">Credit</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ledger?.results.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                                  No ledger entries in this range.
                                </TableCell>
                              </TableRow>
                            )}
                            {ledger?.results.map((e) => (
                              <TableRow
                                key={e.id}
                                className={
                                  Number(e.debit_amount) > 0
                                    ? "bg-red-50 dark:bg-red-950/20"
                                    : Number(e.credit_amount) > 0
                                      ? "bg-green-50 dark:bg-green-950/20"
                                      : undefined
                                }
                              >
                                <TableCell>
                                  {e.reference_type === "invoice" ? (
                                    <Link
                                      href={`/dashboard/sales/invoices?highlight=${e.reference_id}`}
                                      className="text-primary underline underline-offset-2 text-xs font-medium"
                                    >
                                      Invoice
                                    </Link>
                                  ) : (
                                    <span className="text-xs text-muted-foreground capitalize">
                                      {e.reference_type.replace("_", " ")}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>{e.transaction_date}</TableCell>
                                <TableCell>{e.description}</TableCell>
                                <TableCell className="text-right text-red-700 dark:text-red-400">
                                  {Number(e.debit_amount) > 0 ? `Rs. ${e.debit_amount}` : "-"}
                                </TableCell>
                                <TableCell className="text-right text-green-700 dark:text-green-400">
                                  {Number(e.credit_amount) > 0 ? `Rs. ${e.credit_amount}` : "-"}
                                </TableCell>
                                <TableCell className="text-right">Rs. {e.balance}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {ledger && ledger.total_pages > 1 && (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs text-muted-foreground">
                              Page {ledger.page} of {ledger.total_pages} - {ledger.count} entries
                            </span>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={ledgerLoading || ledgerPage <= 1}
                                onClick={() => ledgerFor && loadLedgerPage(ledgerFor, ledgerPage - 1)}
                              >
                                <ChevronLeft className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={ledgerLoading || ledgerPage >= ledger.total_pages}
                                onClick={() => ledgerFor && loadLedgerPage(ledgerFor, ledgerPage + 1)}
                              >
                                <ChevronRight className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    <Dialog open={payFor?.id === c.id} onOpenChange={(open) => !open && setPayFor(null)}>
                        <DialogTrigger
                          render={
                            <Button size="sm" variant={Number(c.outstanding_balance) > 0 ? "default" : "outline"} onClick={() => openPay(c)}>
                              <Receipt className="size-3.5" /> Pay
                            </Button>
                          }
                        />
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Record Payment - {c.name}</DialogTitle>
                          </DialogHeader>
                          <div className="flex flex-col gap-3">
                            <p className="text-sm text-muted-foreground">
                              {c.name} owes Rs. {c.outstanding_balance} overall.
                            </p>
                            <div className="flex flex-col gap-2">
                              <Label>Payment Amount</Label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPaymentType("full");
                                    setAmount(c.outstanding_balance);
                                  }}
                                  className={`rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                                    paymentType === "full"
                                      ? "border-primary bg-primary/10 text-primary font-medium"
                                      : "hover:bg-accent"
                                  }`}
                                >
                                  Full Amount
                                  <div className="text-sm font-semibold">Rs. {c.outstanding_balance}</div>
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
