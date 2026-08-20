"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Warehouse } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VendorStockRow {
  supplier_id: number | null;
  supplier_name: string | null;
  brand: string;
  model: string;
  variant_color: string | null;
  variant_size: string | null;
  available_count: number;
}

export default function StockByVendorPage() {
  const [rows, setRows] = useState<VendorStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandQuery, setBrandQuery] = useState("");

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (brandQuery) params.set("brand", brandQuery);
    api<VendorStockRow[]>(`/api/products/tracking/stock-by-vendor/?${params}`)
      .then(setRows)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load vendor stock."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [brandQuery]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Stock by Vendor</h1>
        <p className="text-sm text-muted-foreground">
          Available tracked units (IMEI/serial), grouped by which supplier they came from.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Filter by brand..."
              value={brandQuery}
              onChange={(e) => setBrandQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Available</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Warehouse className="size-6 opacity-50" />
                      <span>No tracked stock yet.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{row.brand || "-"}</TableCell>
                  <TableCell>{row.model}</TableCell>
                  <TableCell>
                    {[row.variant_color, row.variant_size].filter(Boolean).join(" / ") || "-"}
                  </TableCell>
                  <TableCell>{row.supplier_name ?? "-"}</TableCell>
                  <TableCell className="text-right font-medium">{row.available_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
