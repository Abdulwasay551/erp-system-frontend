"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api, ApiError, Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fadeInUp } from "@/lib/motion";
import { Truck, Pencil, ArrowLeftRight } from "lucide-react";
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
import { Pagination } from "@/components/pagination";
import { SortableHead } from "@/components/sortable-head";
import { DeleteButton } from "@/components/delete-button";

interface Supplier {
  id: number;
  name: string;
  phone: string;
  email: string;
  city: string;
  contact_person: string;
  address: string;
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

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "check", label: "Cheque" },
  { value: "online", label: "Online Payment" },
];

// Distinct from PAYMENT_METHODS above (which matches PurchasePayment.payment_method,
// using "check" and no credit_card/other) - the ledger adjustment endpoint is backed by
// SupplierLedgerAdjustment.payment_method, whose choices use "cheque" and add credit_card/other.
const ADJUSTMENT_PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "credit_card", label: "Credit Card" },
  { value: "online", label: "Online Payment" },
  { value: "other", label: "Other" },
];

const PAGE_SIZE = 25;

export default function SuppliersPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("partner__name");
  const [search, setSearch] = useState("");

  const [payFor, setPayFor] = useState<Supplier | null>(null);
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paying, setPaying] = useState(false);

  const [adjustFor, setAdjustFor] = useState<Supplier | null>(null);
  const [adjustEntryType, setAdjustEntryType] = useState<"debit" | "credit">("debit");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustMethod, setAdjustMethod] = useState("cash");
  const [adjustReference, setAdjustReference] = useState("");
  const [adjustDescription, setAdjustDescription] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [address, setAddress] = useState("");
  const [supplierType, setSupplierType] = useState("distributor");
  const [saving, setSaving] = useState(false);

  function loadSuppliers() {
    const params = new URLSearchParams({ page: String(page), ordering });
    if (search) params.set("search", search);
    api<Paginated<Supplier>>(`/api/purchase/suppliers/?${params}`)
      .then((data) => {
        setSuppliers(data.results);
        setCount(data.count);
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load suppliers."));
  }

  useEffect(loadSuppliers, [page, ordering]);

  function openAdd() {
    setEditingId(null);
    setName("");
    setPhone("");
    setEmail("");
    setCity("");
    setContactPerson("");
    setAddress("");
    setSupplierType("distributor");
    setFormOpen(true);
  }

  function openEditSupplier(s: Supplier) {
    setEditingId(s.id);
    setName(s.name);
    setPhone(s.phone || "");
    setEmail(s.email || "");
    setCity(s.city || "");
    setContactPerson(s.contact_person || "");
    setAddress(s.address || "");
    setSupplierType(s.supplier_type || "distributor");
    setFormOpen(true);
  }

  async function saveSupplier() {
    if (!name.trim()) {
      toast.error("Vendor name is required.");
      return;
    }
    setSaving(true);
    try {
      const body = { name, phone, email, city, contact_person: contactPerson, address, supplier_type: supplierType };
      if (editingId) {
        await api(`/api/purchase/suppliers/${editingId}/`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Vendor updated.");
      } else {
        await api("/api/purchase/suppliers/", { method: "POST", body: JSON.stringify(body) });
        toast.success("Vendor added.");
      }
      setFormOpen(false);
      loadSuppliers();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to save vendor.");
    } finally {
      setSaving(false);
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

  function openAdjust(supplier: Supplier) {
    setAdjustFor(supplier);
    setAdjustEntryType("debit");
    setAdjustAmount("");
    setAdjustMethod("cash");
    setAdjustReference("");
    setAdjustDescription("");
  }

  async function submitAdjustment() {
    if (!adjustFor || !adjustAmount || Number(adjustAmount) <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (!adjustDescription.trim()) {
      toast.error("A description/reason is required.");
      return;
    }
    setAdjusting(true);
    try {
      await api("/api/purchase/supplier-ledger-adjustments/", {
        method: "POST",
        body: JSON.stringify({
          supplier: adjustFor.id,
          entry_type: adjustEntryType,
          amount: adjustAmount,
          payment_method: adjustMethod,
          reference: adjustReference || undefined,
          description: adjustDescription,
          transaction_date: new Date().toISOString().slice(0, 10),
        }),
      });
      toast.success(`${adjustEntryType === "debit" ? "Debit" : "Credit"} recorded for ${adjustFor.name}.`);
      setAdjustFor(null);
      loadSuppliers();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to record adjustment.");
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Vendors you buy stock from.</p>
        </div>
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger render={<Button className="gradient-primary border-none" onClick={openAdd}>Add Vendor</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>Contact Person (optional)</Label>
                  <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Address (optional)</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
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
              <Button onClick={saveSupplier} disabled={saving}>
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
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setPage(1);
            loadSuppliers();
          }
        }}
        className="max-w-sm"
      />

      <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead field="partner__name" ordering={ordering} onSort={setOrdering}>
                  Name
                </SortableHead>
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
                <TableRow key={s.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/contacts/suppliers/detail?id=${s.id}`)}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {s.supplier_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{s.phone || "-"}</TableCell>
                  <TableCell>{s.city || "-"}</TableCell>
                  <TableCell className="text-right">
                    <span className={Number(s.outstanding_balance) > 0 ? "font-medium text-warning" : ""}>
                      Rs. {s.outstanding_balance}
                    </span>
                  </TableCell>
                  <TableCell className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => openEditSupplier(s)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/dashboard/contacts/suppliers/detail?id=${s.id}&tab=ledger`)}
                    >
                      Ledger
                    </Button>

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

                    {admin && (
                      <Dialog open={adjustFor?.id === s.id} onOpenChange={(open) => !open && setAdjustFor(null)}>
                        <DialogTrigger
                          render={
                            <Button size="sm" variant="outline" onClick={() => openAdjust(s)}>
                              <ArrowLeftRight className="size-3.5" /> Debit/Credit
                            </Button>
                          }
                        />
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Ledger Adjustment - {s.name}</DialogTitle>
                          </DialogHeader>
                          <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-2">
                              <Label>Entry Type</Label>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setAdjustEntryType("debit")}
                                  className={`rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                                    adjustEntryType === "debit"
                                      ? "border-danger bg-danger-container/40 text-danger font-medium"
                                      : "hover:bg-accent"
                                  }`}
                                >
                                  Debit
                                  <div className="text-sm font-semibold">You owe more</div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAdjustEntryType("credit")}
                                  className={`rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                                    adjustEntryType === "credit"
                                      ? "border-success bg-success-container/40 text-success font-medium"
                                      : "hover:bg-accent"
                                  }`}
                                >
                                  Credit
                                  <div className="text-sm font-semibold">You owe less</div>
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label>Amount</Label>
                              <Input
                                value={adjustAmount}
                                onChange={(e) => setAdjustAmount(e.target.value)}
                                inputMode="decimal"
                                placeholder="0.00"
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label>Payment Method</Label>
                              <Select
                                items={Object.fromEntries(ADJUSTMENT_PAYMENT_METHODS.map((m) => [m.value, m.label]))}
                                value={adjustMethod}
                                onValueChange={(v) => v && setAdjustMethod(v)}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ADJUSTMENT_PAYMENT_METHODS.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                      {m.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label>Reference (optional)</Label>
                              <Input value={adjustReference} onChange={(e) => setAdjustReference(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label>Description / Reason</Label>
                              <Input
                                value={adjustDescription}
                                onChange={(e) => setAdjustDescription(e.target.value)}
                                placeholder="Why is this being adjusted?"
                              />
                            </div>
                            <Button onClick={submitAdjustment} disabled={adjusting}>
                              {adjusting ? "Saving..." : `Record ${adjustEntryType === "debit" ? "Debit" : "Credit"}`}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}

                    {admin && (
                      <DeleteButton
                        label={`Vendor ${s.name}`}
                        onDelete={() => api(`/api/purchase/suppliers/${s.id}/`, { method: "DELETE" })}
                        onDeleted={loadSuppliers}
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
