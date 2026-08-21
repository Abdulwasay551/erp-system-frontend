"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, openPdf } from "@/lib/api";
import { useIdFromQuery } from "@/lib/use-id-from-query";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { DiscountEntry } from "@/components/discount-editor";
import { LoadingState, ErrorState } from "@/components/data-state";
import { ArrowLeft, Download, Pencil, Undo2 } from "lucide-react";

interface TrackingUnitSummary {
  id: number;
  code: string | null;
  status: string;
}

interface BillItemDetail {
  id: number;
  product: number;
  product_name: string;
  product_tracking_method: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  discounts: DiscountEntry[];
  received_quantity: string;
  tracking_units: TrackingUnitSummary[];
}

interface BillDetail {
  id: number;
  bill_number: string;
  supplier_name: string;
  bill_date: string;
  status: string;
  goods_received: boolean;
  total_amount: string;
  discount_amount: string;
  discount_type: string;
  supplier_invoice_number: string;
  items: BillItemDetail[];
}

export default function BillDetailPage() {
  const id = useIdFromQuery();
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [data, setData] = useState<BillDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  function load() {
    if (!id) return;
    setError(null);
    setData(null);
    api<BillDetail>(`/api/purchase/bills/${id}/`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load bill."));
  }

  useEffect(load, [id]);

  async function downloadPdf() {
    if (!id) return;
    setDownloading(true);
    try {
      await openPdf(`/api/purchase/bills/${id}/pdf/`);
    } catch {
      toast.error("Failed to generate receiving PDF.");
    } finally {
      setDownloading(false);
    }
  }

  if (!id) return <ErrorState message="No bill specified - go back and pick one from the list." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState label="Loading bill..." />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/inventory/receiving/all">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="size-3.5" /> Back to Vendor Bills
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadPdf} disabled={downloading}>
            <Download className="size-3.5" /> Print
          </Button>
          {admin && (
            <Link href={`/dashboard/inventory/receiving/edit?id=${id}`}>
              <Button variant="outline" size="sm">
                <Pencil className="size-3.5" /> Edit
              </Button>
            </Link>
          )}
          {data.goods_received && (
            <Link href={`/dashboard/inventory/receiving/return?id=${id}`}>
              <Button variant="outline" size="sm">
                <Undo2 className="size-3.5" /> Return to Supplier
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-xl font-semibold">{data.bill_number}</h1>
        <p className="text-sm text-muted-foreground">{data.supplier_name}</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 text-sm">
          <div className="grid grid-cols-2 gap-2 text-muted-foreground md:grid-cols-4">
            <span>
              Supplier: <span className="text-foreground">{data.supplier_name}</span>
            </span>
            <span>
              Date: <span className="text-foreground">{data.bill_date}</span>
            </span>
            <span>
              Status: <StatusBadge status={data.status} />
            </span>
            <span>
              Goods:{" "}
              {data.goods_received ? (
                <Badge variant="outline" className="bg-success-container text-success border-transparent">
                  Received
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-warning-container text-warning border-transparent">
                  Pending
                </Badge>
              )}
            </span>
            {data.supplier_invoice_number && (
              <span>
                Supplier Invoice #: <span className="text-foreground">{data.supplier_invoice_number}</span>
              </span>
            )}
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
                {item.tracking_units.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2">
                    {item.tracking_units.map((unit) => (
                      <div key={unit.id} className="flex items-center gap-1 text-xs">
                        <span className="text-muted-foreground">{unit.status === "available" ? "" : `(${unit.status}) `}</span>
                        <span>{unit.code ?? <span className="text-muted-foreground">&mdash;</span>}</span>
                      </div>
                    ))}
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
            <span className="text-base font-semibold">Total: Rs. {data.total_amount}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
