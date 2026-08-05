"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck } from "lucide-react";
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

interface Supplier {
  id: number;
  name: string;
  phone: string;
  email: string;
  city: string;
  supplier_type: string;
  outstanding_balance: string;
}

const SUPPLIER_TYPES = [
  { value: "distributor", label: "Distributor" },
  { value: "wholesaler", label: "Wholesaler" },
  { value: "manufacturer", label: "Manufacturer" },
  { value: "retailer", label: "Retailer" },
  { value: "other", label: "Other" },
];

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
  { value: "check", label: "Cheque" },
  { value: "online", label: "Online Payment" },
];

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [ledgerFor, setLedgerFor] = useState<Supplier | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const [payFor, setPayFor] = useState<Supplier | null>(null);
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paying, setPaying] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [supplierType, setSupplierType] = useState("distributor");
  const [saving, setSaving] = useState(false);

  function loadSuppliers(q?: string) {
    const qs = q ? `?search=${encodeURIComponent(q)}` : "";
    api<Supplier[]>(`/api/purchase/suppliers/${qs}`).then(setSuppliers).catch(() => {});
  }

  useEffect(loadSuppliers, []);

  async function addSupplier() {
    if (!name.trim()) {
      toast.error("Vendor name is required.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/purchase/suppliers/", {
        method: "POST",
        body: JSON.stringify({ name, phone, email, city, supplier_type: supplierType }),
      });
      toast.success("Vendor added.");
      setName("");
      setPhone("");
      setEmail("");
      setCity("");
      setSupplierType("distributor");
      setAddOpen(false);
      loadSuppliers(search);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to add vendor.");
    } finally {
      setSaving(false);
    }
  }

  async function viewLedger(supplier: Supplier) {
    setLedgerFor(supplier);
    try {
      const data = await api<LedgerEntry[]>(`/api/purchase/suppliers/${supplier.id}/ledger/`);
      setLedger(data);
    } catch {
      toast.error("Failed to load ledger.");
    }
  }

  function openPay(supplier: Supplier) {
    setPayFor(supplier);
    setPaymentType("full");
    setAmount(supplier.outstanding_balance);
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
      await api("/api/purchase/purchase-payments/", {
        method: "POST",
        body: JSON.stringify({
          supplier: payFor.id,
          amount,
          payment_method: method,
          payment_date: new Date().toISOString().slice(0, 10),
          reference_number: reference || undefined,
        }),
      });
      toast.success(`Payment recorded for ${payFor.name}.`);
      setAmount("");
      setReference("");
      setPayFor(null);
      loadSuppliers();
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
          <h1 className="text-xl font-semibold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Vendors you buy stock from.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button>Add Vendor</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Vendor</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. M&P Distributor" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>Phone (optional)</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>City (optional)</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Email (optional)</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Vendor Type</Label>
                <Select
                  items={Object.fromEntries(SUPPLIER_TYPES.map((t) => [t.value, t.label]))}
                  value={supplierType}
                  onValueChange={(v) => v && setSupplierType(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addSupplier} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input
        placeholder="Search vendors by name, phone, city..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && loadSuppliers(search)}
        className="max-w-sm"
      />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Truck className="size-6 opacity-50" />
                      <span>No vendors yet - add one to start recording purchases.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {s.supplier_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{s.phone || "-"}</TableCell>
                  <TableCell>{s.city || "-"}</TableCell>
                  <TableCell className="text-right">
                    <span className={Number(s.outstanding_balance) > 0 ? "font-medium text-amber-600 dark:text-amber-500" : ""}>
                      Rs. {s.outstanding_balance}
                    </span>
                  </TableCell>
                  <TableCell className="flex gap-2 justify-end">
                    <Dialog
                      open={ledgerFor?.id === s.id}
                      onOpenChange={(open) => !open && setLedgerFor(null)}
                    >
                      <DialogTrigger
                        render={
                          <Button variant="outline" size="sm" onClick={() => viewLedger(s)}>
                            Ledger
                          </Button>
                        }
                      />
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>{s.name} - Ledger</DialogTitle>
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

                    <Dialog open={payFor?.id === s.id} onOpenChange={(open) => !open && setPayFor(null)}>
                      <DialogTrigger
                        render={
                          <Button size="sm" onClick={() => openPay(s)}>
                            Pay
                          </Button>
                        }
                      />
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Record Payment - {s.name}</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-3">
                          <p className="text-sm text-muted-foreground">
                            You owe {s.name} Rs. {s.outstanding_balance} overall.
                          </p>
                          <div className="flex flex-col gap-2">
                            <Label>Payment Amount</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentType("full");
                                  setAmount(s.outstanding_balance);
                                }}
                                className={`rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                                  paymentType === "full"
                                    ? "border-primary bg-primary/10 text-primary font-medium"
                                    : "hover:bg-accent"
                                }`}
                              >
                                Full Amount
                                <div className="text-sm font-semibold">Rs. {s.outstanding_balance}</div>
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
                              placeholder={paymentType === "partial" ? "Amount paid" : undefined}
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
