"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Receipt } from "lucide-react";
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
  description: string;
  debit_amount: string;
  credit_amount: string;
  balance: string;
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
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

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
    api<Customer[]>(`/api/crm/customers/${qs}`).then(setCustomers).catch(() => {});
  }

  useEffect(loadCustomers, []);

  async function viewLedger(customer: Customer) {
    setLedgerFor(customer);
    try {
      const data = await api<LedgerEntry[]>(`/api/crm/customers/${customer.id}/ledger/`);
      setLedger(data);
    } catch {
      toast.error("Failed to load ledger.");
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
    setPayFor(customer);
    setPaymentType("full");
    setAmount(customer.outstanding_balance);
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
                      <span>No customers yet - add one, or they'll be created automatically at checkout.</span>
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
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>{c.name} - Ledger</DialogTitle>
                        </DialogHeader>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right">Debit</TableHead>
                              <TableHead className="text-right">Credit</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ledger.map((e) => (
                              <TableRow key={e.id}>
                                <TableCell>{e.transaction_date}</TableCell>
                                <TableCell>{e.description}</TableCell>
                                <TableCell className="text-right">
                                  {Number(e.debit_amount) > 0 ? `Rs. ${e.debit_amount}` : "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {Number(e.credit_amount) > 0 ? `Rs. ${e.credit_amount}` : "-"}
                                </TableCell>
                                <TableCell className="text-right">Rs. {e.balance}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </DialogContent>
                    </Dialog>

                    {Number(c.outstanding_balance) > 0 && (
                      <Dialog open={payFor?.id === c.id} onOpenChange={(open) => !open && setPayFor(null)}>
                        <DialogTrigger
                          render={
                            <Button size="sm" onClick={() => openPay(c)}>
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
                    )}
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
