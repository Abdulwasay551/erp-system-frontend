"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, openPdf } from "@/lib/api";
import { useIdFromQuery } from "@/lib/use-id-from-query";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { DiscountEntry } from "@/components/discount-editor";
import { LoadingState, ErrorState } from "@/components/data-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Download, Pencil, Undo2 } from "lucide-react";

interface InvoiceItemDetail {
  id: number;
  product: number;
  product_name: string;
  product_tracking_method: string;
  tracking_unit: number | null;
  tracking_identifier: string | null;
  tracking_status: string | null;
  quantity: string;
  unit_price: string;
  line_total: string;
  discounts: DiscountEntry[];
}

interface InvoiceDetail {
  id: number;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  status: string;
  total: string;
  discount_amount: string;
  discount_type: string;
  outstanding_amount: string;
  items: InvoiceItemDetail[];
}

export default function InvoiceDetailPage() {
  const id = useIdFromQuery();
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [data, setData] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  function load() {
    if (!id) return;
    setError(null);
    setData(null);
    api<InvoiceDetail>(`/api/sales/invoices/${id}/`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load invoice."));
  }

  useEffect(load, [id]);

  async function downloadPdf(size: "mini" | "a4") {
    if (!id) return;
    setDownloading(true);
    try {
      await openPdf(`/api/sales/invoices/${id}/pdf/?size=${size}`);
    } catch {
      toast.error("Failed to generate invoice PDF.");
    } finally {
      setDownloading(false);
    }
  }

  if (!id) return <ErrorState message="No invoice specified - go back and pick one from the list." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState label="Loading invoice..." />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/sales/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-3.5" /> Back to Invoices
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" disabled={downloading}>
                  <Download className="size-3.5" /> Print
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => downloadPdf("mini")}>Mini receipt (billing machine)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadPdf("a4")}>A4 invoice (printer)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {admin && (
            <Link href={`/dashboard/sales/invoices/edit?id=${id}`}>
              <Button variant="outline" size="sm">
                <Pencil className="size-3.5" /> Edit
              </Button>
            </Link>
          )}
          <Link href={`/dashboard/sales/invoices/return?id=${id}`}>
            <Button variant="outline" size="sm">
              <Undo2 className="size-3.5" /> Return
            </Button>
          </Link>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-semibold">{data.invoice_number}</h1>
        <p className="text-sm text-muted-foreground">{data.customer_name}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 text-sm">
          <div className="grid grid-cols-2 gap-2 text-muted-foreground md:grid-cols-4">
            <span>
              Customer: <span className="text-foreground">{data.customer_name}</span>
            </span>
            <span>
              Date: <span className="text-foreground">{data.invoice_date}</span>
            </span>
            <span>
              Status: <StatusBadge status={data.status} />
            </span>
            <span>
              Outstanding: <span className="text-foreground">Rs. {data.outstanding_amount}</span>
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {data.items.map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/dashboard/inventory/products/detail?id=${item.product}`}
                    className="font-medium hover:underline"
                  >
                    {item.product_name}
                  </Link>
                  <span className="text-muted-foreground">
                    {item.quantity} &times; Rs. {item.unit_price} = Rs. {item.line_total}
                  </span>
                </div>
                {item.tracking_unit && (
                  <div className="mt-2 flex items-center gap-1 border-t pt-2 text-xs">
                    <span className="text-muted-foreground">
                      {item.tracking_status && item.tracking_status !== "available" ? `(${item.tracking_status}) ` : ""}
                    </span>
                    <span>{item.tracking_identifier ?? <span className="text-muted-foreground">&mdash;</span>}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col items-end gap-1 border-t pt-3 text-right">
            {Number(data.discount_amount) > 0 && (
              <span className="text-muted-foreground">
                Discount ({data.discount_type === "percent" ? `${data.discount_amount}%` : `Rs. ${data.discount_amount}`})
              </span>
            )}
            <span className="text-base font-semibold">Total: Rs. {data.total}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
