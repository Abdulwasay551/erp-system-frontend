"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api, ApiError, openPdf } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, PackageSearch } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState, ErrorState } from "@/components/data-state";

interface Bill {
  id: number;
  bill_number: string;
  supplier_name: string;
  bill_date: string;
  status: string;
  goods_received: boolean;
  total_amount: string;
  paid_amount: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  partially_paid: "secondary",
  approved: "outline",
  draft: "outline",
  overdue: "destructive",
  cancelled: "destructive",
};

export default function AllBillsPage() {
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingFor, setDownloadingFor] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  function load() {
    setError(null);
    api<Bill[]>("/api/purchase/bills/")
      .then((data) => setBills(data.sort((a, b) => b.id - a.id)))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load bills."));
  }

  useEffect(load, []);

  useEffect(() => {
    if (highlightId && bills) {
      const el = rowRefs.current[Number(highlightId)];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, bills]);

  async function downloadPdf(bill: Bill) {
    setDownloadingFor(bill.id);
    try {
      await openPdf(`/api/purchase/bills/${bill.id}/pdf/`);
    } catch {
      toast.error("Failed to generate receiving PDF.");
    } finally {
      setDownloadingFor(null);
    }
  }

  if (bills === null && !error) return <LoadingState label="Loading vendor bills..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Vendor Bills</h1>
        <p className="text-sm text-muted-foreground">Every bill recorded from a supplier, received or still pending.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <PackageSearch className="size-6 opacity-50" />
                      <span>No vendor bills recorded yet.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {bills?.map((bill) => (
                <TableRow
                  key={bill.id}
                  ref={(el) => {
                    rowRefs.current[bill.id] = el;
                  }}
                  className={highlightId && Number(highlightId) === bill.id ? "bg-primary/10 transition-colors" : undefined}
                >
                  <TableCell className="font-medium">{bill.bill_number}</TableCell>
                  <TableCell>{bill.supplier_name}</TableCell>
                  <TableCell>{bill.bill_date}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[bill.status] ?? "outline"}>{bill.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={bill.goods_received ? "default" : "secondary"}>
                      {bill.goods_received ? "Received" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">Rs. {bill.total_amount}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadPdf(bill)}
                      disabled={downloadingFor === bill.id}
                    >
                      <Download className="size-3.5" />
                    </Button>
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
