"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api, ApiError, openPdf, Paginated } from "@/lib/api";
import { useIdFromQuery } from "@/lib/use-id-from-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { LoadingState, ErrorState } from "@/components/data-state";
import { StatCard } from "@/components/stat-card";
import { Pagination } from "@/components/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, DollarSign, FileText, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  cnic: string;
  address: string;
  outstanding_balance: string;
}

interface InvoiceRow {
  id: number;
  invoice_number: string;
  invoice_date: string;
  total: string;
  paid_amount: string;
  outstanding_amount: string;
  status: string;
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

interface ListPage<T> {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: T[];
}

interface AnalyticsDay {
  date: string;
  spend: string;
  invoice_count: number;
}

const PAGE_SIZE = 25;

function money(v: string | number) {
  return `Rs. ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function CustomerDetailPage() {
  const id = useIdFromQuery();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "invoices";

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<ListPage<InvoiceRow> | null>(null);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceDateFrom, setInvoiceDateFrom] = useState("");
  const [invoiceDateTo, setInvoiceDateTo] = useState("");

  const [ledger, setLedger] = useState<ListPage<LedgerEntry> | null>(null);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerDateFrom, setLedgerDateFrom] = useState("");
  const [ledgerDateTo, setLedgerDateTo] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [payments, setPayments] = useState<ListPage<LedgerEntry> | null>(null);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsDateFrom, setPaymentsDateFrom] = useState("");
  const [paymentsDateTo, setPaymentsDateTo] = useState("");

  const [analytics, setAnalytics] = useState<AnalyticsDay[] | null>(null);

  function setTab(next: string) {
    router.push(`/dashboard/contacts/customers/detail?id=${id}&tab=${next}`);
  }

  function load() {
    if (!id) return;
    setError(null);
    api<Customer>(`/api/crm/customers/${id}/`)
      .then(setCustomer)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load customer."));
  }
  useEffect(load, [id]);

  function loadInvoices(page: number) {
    if (!id) return;
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (invoiceSearch) params.set("search", invoiceSearch);
    if (invoiceDateFrom) params.set("date_from", invoiceDateFrom);
    if (invoiceDateTo) params.set("date_to", invoiceDateTo);
    api<ListPage<InvoiceRow>>(`/api/crm/customers/${id}/invoices/?${params}`)
      .then((data) => {
        setInvoices(data);
        setInvoicePage(page);
      })
      .catch(() => toast.error("Failed to load invoices."));
  }
  useEffect(() => {
    if (tab === "invoices") loadInvoices(1);
  }, [id, tab]);

  function loadLedger(page: number) {
    if (!id) return;
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (ledgerDateFrom) params.set("date_from", ledgerDateFrom);
    if (ledgerDateTo) params.set("date_to", ledgerDateTo);
    api<ListPage<LedgerEntry>>(`/api/crm/customers/${id}/ledger/?${params}`)
      .then((data) => {
        setLedger(data);
        setLedgerPage(page);
      })
      .catch(() => toast.error("Failed to load ledger."));
  }
  useEffect(() => {
    if (tab === "ledger") loadLedger(1);
  }, [id, tab]);

  function loadPayments(page: number) {
    if (!id) return;
    const params = new URLSearchParams({ page: String(page), page_size: "20", reference_type: "payment" });
    if (paymentsDateFrom) params.set("date_from", paymentsDateFrom);
    if (paymentsDateTo) params.set("date_to", paymentsDateTo);
    api<ListPage<LedgerEntry>>(`/api/crm/customers/${id}/ledger/?${params}`)
      .then((data) => {
        setPayments(data);
        setPaymentsPage(page);
      })
      .catch(() => toast.error("Failed to load payments."));
  }
  useEffect(() => {
    if (tab === "payments") loadPayments(1);
  }, [id, tab]);

  useEffect(() => {
    if (tab !== "analytics" || !id) return;
    api<{ days: AnalyticsDay[] }>(`/api/crm/customers/${id}/analytics/?days=90`)
      .then((data) => setAnalytics(data.days))
      .catch(() => toast.error("Failed to load analytics."));
  }, [id, tab]);

  async function downloadLedgerPdf() {
    if (!id) return;
    setDownloadingPdf(true);
    try {
      const params = new URLSearchParams();
      if (ledgerDateFrom) params.set("date_from", ledgerDateFrom);
      if (ledgerDateTo) params.set("date_to", ledgerDateTo);
      await openPdf(`/api/crm/customers/${id}/ledger/pdf/?${params}`);
    } catch {
      toast.error("Failed to generate ledger PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  if (!id) return <ErrorState message="No customer specified - go back and pick one from the list." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!customer) return <LoadingState label="Loading customer..." />;

  const totalSpend = analytics?.reduce((sum, d) => sum + Number(d.spend), 0) ?? 0;
  const totalInvoices = analytics?.reduce((sum, d) => sum + d.invoice_count, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dashboard/contacts/customers">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="size-3.5" /> Back to Customers
        </Button>
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            {customer.phone || "-"} {customer.email ? `· ${customer.email}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className={`text-lg font-semibold ${Number(customer.outstanding_balance) > 0 ? "text-warning" : ""}`}>
            {money(customer.outstanding_balance)}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => v && setTab(String(v))}>
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  placeholder="Search invoice number..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadInvoices(1)}
                  className="max-w-xs"
                />
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={invoiceDateFrom} onChange={(e) => setInvoiceDateFrom(e.target.value)} className="h-8 w-36" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={invoiceDateTo} onChange={(e) => setInvoiceDateTo(e.target.value)} className="h-8 w-36" />
                </div>
                <Button size="sm" variant="outline" onClick={() => loadInvoices(1)}>
                  Apply Filter
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices?.results.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No invoices match this filter.
                      </TableCell>
                    </TableRow>
                  )}
                  {invoices?.results.map((inv) => (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/dashboard/sales/invoices/detail?id=${inv.id}`)}
                    >
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.invoice_date}</TableCell>
                      <TableCell className="text-right">{money(inv.total)}</TableCell>
                      <TableCell className="text-right">{money(inv.outstanding_amount)}</TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {invoices && <Pagination page={invoicePage} pageSize={PAGE_SIZE} count={invoices.count} onPageChange={loadInvoices} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={ledgerDateFrom} onChange={(e) => setLedgerDateFrom(e.target.value)} className="h-8 w-36" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={ledgerDateTo} onChange={(e) => setLedgerDateTo(e.target.value)} className="h-8 w-36" />
                </div>
                <Button size="sm" variant="outline" onClick={() => loadLedger(1)}>
                  Apply Filter
                </Button>
                <Button size="sm" variant="outline" className="ml-auto" onClick={downloadLedgerPdf} disabled={downloadingPdf}>
                  <Download className="size-3.5" /> {downloadingPdf ? "Generating..." : "Download PDF"}
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
                      className={Number(e.debit_amount) > 0 ? "bg-danger-container/40" : Number(e.credit_amount) > 0 ? "bg-success-container/40" : undefined}
                    >
                      <TableCell>
                        {e.reference_type === "invoice" ? (
                          <Link href={`/dashboard/sales/invoices/detail?id=${e.reference_id}`} className="text-primary underline underline-offset-2 text-xs font-medium">
                            Invoice
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground capitalize">{e.reference_type.replace("_", " ")}</span>
                        )}
                      </TableCell>
                      <TableCell>{e.transaction_date}</TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell className="text-right text-danger">{Number(e.debit_amount) > 0 ? money(e.debit_amount) : "-"}</TableCell>
                      <TableCell className="text-right text-success">{Number(e.credit_amount) > 0 ? money(e.credit_amount) : "-"}</TableCell>
                      <TableCell className="text-right">{money(e.balance)}</TableCell>
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
                    <Button size="sm" variant="outline" disabled={ledgerPage <= 1} onClick={() => loadLedger(ledgerPage - 1)}>
                      <ChevronLeft className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" disabled={ledgerPage >= ledger.total_pages} onClick={() => loadLedger(ledgerPage + 1)}>
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={paymentsDateFrom} onChange={(e) => setPaymentsDateFrom(e.target.value)} className="h-8 w-36" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={paymentsDateTo} onChange={(e) => setPaymentsDateTo(e.target.value)} className="h-8 w-36" />
                </div>
                <Button size="sm" variant="outline" onClick={() => loadPayments(1)}>
                  Apply Filter
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments?.results.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                        No payments in this range.
                      </TableCell>
                    </TableRow>
                  )}
                  {payments?.results.map((e) => (
                    <TableRow key={e.id} className="bg-success-container/40">
                      <TableCell>{e.transaction_date}</TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell className="text-right text-success">{money(e.credit_amount)}</TableCell>
                      <TableCell className="text-right">{money(e.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {payments && payments.total_pages > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    Page {payments.page} of {payments.total_pages} - {payments.count} payments
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={paymentsPage <= 1} onClick={() => loadPayments(paymentsPage - 1)}>
                      <ChevronLeft className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" disabled={paymentsPage >= payments.total_pages} onClick={() => loadPayments(paymentsPage + 1)}>
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          {!analytics ? (
            <LoadingState label="Loading analytics..." />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <StatCard label="Total Spend (90d)" value={money(totalSpend)} icon={DollarSign} tone="neutral" />
                <StatCard label="Invoices (90d)" value={String(totalInvoices)} icon={FileText} tone="neutral" />
                <StatCard label="Avg per Invoice" value={money(totalInvoices ? totalSpend / totalInvoices : 0)} icon={TrendingUp} tone="neutral" />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Spend Over Time</CardTitle>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.map((d) => ({ ...d, spend: Number(d.spend) }))}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => money(v as number)} />
                      <Line type="monotone" dataKey="spend" stroke="var(--color-primary, #6366f1)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
