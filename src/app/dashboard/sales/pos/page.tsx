"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError, openPdf } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/searchable-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserRound, Download } from "lucide-react";

interface Customer {
  id: number;
  name: string;
  phone: string;
}

interface SearchResult {
  product_id: number;
  tracking_id: number | null;
  name: string;
  brand: string;
  variant: string | null;
  identifier: string;
  tracking_method: string;
  unit_price: string;
  available_qty: string | number;
}

interface CartLine {
  key: string;
  product_id: number;
  tracking_id: number | null;
  name: string;
  identifier: string;
  unit_price: number;
  quantity: number;
  max_qty: number;
}

interface CheckoutResponse {
  invoice_id: number;
  invoice_number: string;
  total: string;
  paid_amount: string;
  outstanding_amount: string;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "credit_card", label: "Credit Card" },
  { value: "online", label: "Online Payment" },
  { value: "other", label: "Other" },
];

export default function POSPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerOptions, setCustomerOptions] = useState<{ value: string; label: string; description?: string }[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [discount, setDiscount] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<CheckoutResponse | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const cartSubtotal = cart.reduce((sum, line) => sum + line.unit_price * line.quantity, 0);
  const discountAmount = Math.min(Math.max(Number(discount) || 0, 0), cartSubtotal);
  const cartTotal = cartSubtotal - discountAmount;

  async function searchCustomers(q: string) {
    setCustomerSearching(true);
    try {
      const data = await api<Customer[]>(`/api/crm/customers/?search=${encodeURIComponent(q)}`);
      setCustomerOptions(data.map((c) => ({ value: String(c.id), label: c.name, description: c.phone || undefined })));
    } catch {
      // keep previous options on failure
    } finally {
      setCustomerSearching(false);
    }
  }

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const data = await api<SearchResult[]>(`/api/sales/pos/search/?q=${encodeURIComponent(query)}`);
      setResults(data);
      if (data.length === 0) toast.info("No matching products found.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  function addToCart(item: SearchResult) {
    const key = item.tracking_id ? `t-${item.tracking_id}` : `p-${item.product_id}`;
    setCart((prev) => {
      if (prev.some((l) => l.key === key)) {
        toast.info("Already in cart.");
        return prev;
      }
      return [
        ...prev,
        {
          key,
          product_id: item.product_id,
          tracking_id: item.tracking_id,
          name: item.variant ? `${item.name} (${item.variant})` : item.name,
          identifier: item.identifier,
          unit_price: parseFloat(item.unit_price),
          quantity: 1,
          max_qty: item.tracking_id ? 1 : Number(item.available_qty),
        },
      ];
    });
    setQuery("");
    setResults([]);
  }

  function updateQuantity(key: string, quantity: number) {
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, Math.min(quantity, l.max_qty)) } : l))
    );
  }

  function removeFromCart(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  async function checkout() {
    if (cart.length === 0) {
      toast.error("Cart is empty.");
      return;
    }
    setCheckingOut(true);
    try {
      const payload = {
        customer_id: customerId ? Number(customerId) : undefined,
        items: cart.map((l) => ({
          product_id: l.product_id,
          tracking_id: l.tracking_id ?? undefined,
          quantity: l.tracking_id ? undefined : l.quantity,
          unit_price: l.unit_price,
        })),
        discount_amount: discountAmount || undefined,
        payment: {
          method: paymentMethod,
          amount: cartTotal,
          reference: paymentReference || undefined,
        },
      };
      const result = await api<CheckoutResponse>("/api/sales/pos/checkout/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setLastInvoice(result);
      setCart([]);
      setPaymentReference("");
      setDiscount("");
      setCustomerId(null);
      setCustomerOptions([]);
      toast.success(`Invoice ${result.invoice_number} created.`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Checkout failed.");
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <h1 className="text-xl font-semibold">Point of Sale</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Search / Scan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                autoFocus
                placeholder="Scan IMEI/barcode or type a name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
              <Button onClick={runSearch} disabled={searching}>
                {searching ? "..." : "Search"}
              </Button>
            </div>

            {results.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Identifier</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.tracking_id ?? `p-${r.product_id}`}>
                      <TableCell>
                        {r.name}
                        {r.variant && <span className="text-muted-foreground"> ({r.variant})</span>}
                        {r.tracking_method !== "none" && (
                          <Badge variant="outline" className="ml-2">
                            {r.tracking_method}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.identifier}</TableCell>
                      <TableCell className="text-right">Rs. {r.unit_price}</TableCell>
                      <TableCell className="text-right">{r.available_qty}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => addToCart(r)}>
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Cart</CardTitle>
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items yet - search above to add.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((l) => (
                    <TableRow key={l.key}>
                      <TableCell>{l.name}</TableCell>
                      <TableCell className="text-right">Rs. {l.unit_price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {l.tracking_id ? (
                          l.quantity
                        ) : (
                          <Input
                            type="number"
                            min={1}
                            max={l.max_qty}
                            value={l.quantity}
                            onChange={(e) => updateQuantity(l.key, Number(e.target.value))}
                            className="w-20 text-right ml-auto"
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        Rs. {(l.unit_price * l.quantity).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeFromCart(l.key)}>
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Payment</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>Rs. {cartSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Discount</Label>
              <Input
                type="number"
                min={0}
                max={cartSubtotal}
                inputMode="decimal"
                placeholder="0.00"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between text-lg font-semibold border-t pt-3">
              <span>Total</span>
              <span>Rs. {cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <UserRound className="size-3.5 text-muted-foreground" /> Customer (optional)
              </label>
              <SearchableSelect
                value={customerId}
                onValueChange={setCustomerId}
                options={customerOptions}
                onSearch={searchCustomers}
                loading={customerSearching}
                placeholder="Walk-in customer"
                emptyText="No customers match - add one from the Customers page."
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Payment method</label>
              <Select
                items={Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]))}
                value={paymentMethod}
                onValueChange={(value) => value && setPaymentMethod(value)}
              >
                <SelectTrigger>
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
              <label className="text-sm font-medium">Reference (optional)</label>
              <Input
                placeholder="Transaction ID, cheque no..."
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>
            <Button onClick={checkout} disabled={checkingOut || cart.length === 0} className="w-full">
              {checkingOut ? "Processing..." : "Complete Sale"}
            </Button>
          </CardContent>
        </Card>

        {lastInvoice && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Last Invoice</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              <p>
                <span className="text-muted-foreground">Invoice: </span>
                {lastInvoice.invoice_number}
              </p>
              <p>
                <span className="text-muted-foreground">Total: </span>Rs. {lastInvoice.total}
              </p>
              <p>
                <span className="text-muted-foreground">Outstanding: </span>Rs.{" "}
                {lastInvoice.outstanding_amount}
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" className="mt-2 w-fit" disabled={downloadingPdf}>
                      <Download className="size-3.5" /> {downloadingPdf ? "Generating..." : "Open PDF"}
                    </Button>
                  }
                />
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={async () => {
                      setDownloadingPdf(true);
                      try {
                        await openPdf(`/api/sales/invoices/${lastInvoice.invoice_id}/pdf/?size=mini`);
                      } catch {
                        toast.error("Failed to generate invoice PDF.");
                      } finally {
                        setDownloadingPdf(false);
                      }
                    }}
                  >
                    Mini receipt (billing machine)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      setDownloadingPdf(true);
                      try {
                        await openPdf(`/api/sales/invoices/${lastInvoice.invoice_id}/pdf/?size=a4`);
                      } catch {
                        toast.error("Failed to generate invoice PDF.");
                      } finally {
                        setDownloadingPdf(false);
                      }
                    }}
                  >
                    A4 invoice (printer)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
