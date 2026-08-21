"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api, ApiError, openPdf, Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { fadeInUp } from "@/lib/motion";
import { Download, PackageSearch, Pencil, Undo2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState, ErrorState } from "@/components/data-state";
import { Pagination } from "@/components/pagination";
import { SortableHead } from "@/components/sortable-head";
import { DeleteButton } from "@/components/delete-button";

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

const PAGE_SIZE = 25;

export default function AllBillsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const router = useRouter();
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("-bill_date");
  const [error, setError] = useState<string | null>(null);
  const [downloadingFor, setDownloadingFor] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  function load() {
    setError(null);
    const params = new URLSearchParams({ page: String(page), ordering });
    api<Paginated<Bill>>(`/api/purchase/bills/?${params}`)
      .then((data) => {
        setBills(data.results);
        setCount(data.count);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load bills."));
  }

  useEffect(load, [page, ordering]);

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

      <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <SortableHead field="bill_date" ordering={ordering} onSort={setOrdering}>
                    Date
                  </SortableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received</TableHead>
                  <SortableHead field="total_amount" ordering={ordering} onSort={setOrdering} className="text-right">
                    Total
                  </SortableHead>
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
                    className={`cursor-pointer ${highlightId && Number(highlightId) === bill.id ? "bg-primary/10 transition-colors" : ""}`}
                    onClick={() => router.push(`/dashboard/inventory/receiving/detail?id=${bill.id}`)}
                  >
                    <TableCell className="font-medium">{bill.bill_number}</TableCell>
                    <TableCell>{bill.supplier_name}</TableCell>
                    <TableCell>{bill.bill_date}</TableCell>
                    <TableCell>
                      <StatusBadge status={bill.status} />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          bill.goods_received
                            ? "bg-success-container text-success border-transparent"
                            : "bg-warning-container text-warning border-transparent"
                        }
                      >
                        {bill.goods_received ? "Received" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">Rs. {bill.total_amount}</TableCell>
                    <TableCell className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadPdf(bill)}
                        disabled={downloadingFor === bill.id}
                      >
                        <Download className="size-3.5" />
                      </Button>
                      {admin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/inventory/receiving/edit?id=${bill.id}`)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {bill.goods_received && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/inventory/receiving/return?id=${bill.id}`)}
                        >
                          <Undo2 className="size-3.5" /> Return
                        </Button>
                      )}
                      {admin && (
                        <DeleteButton
                          label={`Bill ${bill.bill_number}`}
                          onDelete={() => api(`/api/purchase/bills/${bill.id}/`, { method: "DELETE" })}
                          onDeleted={load}
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
