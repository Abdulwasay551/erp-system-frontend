"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api, ApiError, openPdf, Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Download, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
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
  { value: "check", label: "Cheque" },
  { value: "online", label: "Online Payment" },
];

const PAGE_SIZE = 25;

export default function SuppliersPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("partner__name");
  const [search, setSearch] = useState("");
  const [ledgerFor, setLedgerFor] = useState<Supplier | null>(null);
  const [ledger, setLedger] = useState<LedgerPage | null>(null);
  const [ledgerDateFrom, setLedgerDateFrom] = useState("");
  const [ledgerDateTo, setLedgerDateTo] = useState("");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [downloadingLedgerPdf, setDownloadingLedgerPdf] = useState(false);

  const [payFor, setPayFor] = useState<Supplier | null>(null);
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paying, setPaying] = useState(false);

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

  function ledgerQuery(page: number) {
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (ledgerDateFrom) params.set("date_from", ledgerDateFrom);
    if (ledgerDateTo) params.set("date_to", ledgerDateTo);
    return params.toString();
  }

  async function loadLedgerPage(supplier: Supplier, page: number) {
    setLedgerLoading(true);
    try {
      const data = await api<LedgerPage>(`/api/purchase/suppliers/${supplier.id}/ledger/?${ledgerQuery(page)}`);
      setLedger(data);
      setLedgerPage(page);
    } catch {
      toast.error("Failed to load ledger.");
    } finally {
      setLedgerLoading(false);
    }
  }

  function viewLedger(supplier: Supplier) {
    setLedgerFor(supplier);
    setLedgerDateFrom("");
    setLedgerDateTo("");
    setLedger(null);
    loadLedgerPage(supplier, 1);
  }

  async function downloadLedgerPdf() {
    if (!ledgerFor) return;
    setDownloadingLedgerPdf(true);
    try {
      const params = new URLSearchParams();
      if (ledgerDateFrom) params.set("date_from", ledgerDateFrom);
      if (ledgerDateTo) params.set("date_to", ledgerDateTo);
      await openPdf(`/api/purchase/suppliers/${ledgerFor.id}/ledger/pdf/?${params.toString()}`);
    } catch {
      toast.error("Failed to generate ledger PDF.");
    } finally {
      setDownloadingLedgerPdf(false);
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
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger render={<Button onClick={openAdd}>Add Vendor</Button>} />
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
                    {/* Deferred: hardcoded amber -> lib/status.ts text-warning token, left for the
                        contacts redesign pass to avoid duplicate-effort with that phase. */}
                    <span className={Number(s.outstanding_balance) > 0 ? "font-medium text-amber-600 dark:text-amber-500" : ""}>
                      Rs. {s.outstanding_balance}
                    </span>
                  </TableCell>
                  <TableCell className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => openEditSupplier(s)}>
                      <Pencil className="size-3.5" />
                    </Button>
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
                      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{s.name} - Ledger</DialogTitle>
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
                            {/* Deferred: hardcoded red/green debit-credit row tinting -> semantic
                                danger/success tokens, left for the contacts redesign pass to avoid
                                duplicate-effort with that phase. */}
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
                                  {e.reference_type === "bill" ? (
                                    <Link
                                      href={`/dashboard/inventory/receiving/all?highlight=${e.reference_id}`}
                                      className="text-primary underline underline-offset-2 text-xs font-medium"
                                    >
                                      Bill
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
    </div>
  );
}
