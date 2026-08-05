"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Search } from "lucide-react";
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
import { SearchableSelect } from "@/components/searchable-select";

interface Product {
  id: number;
  sku: string;
  name: string;
  category_name: string | null;
  tracking_method: string;
  selling_price: string;
  cost_price: string;
  tracking_units_count: number;
  flags: string[];
  is_active: boolean;
}

interface Category {
  id: number;
  name: string;
}

interface VendorStockRow {
  supplier_id: number | null;
  supplier_name: string | null;
  brand: string;
  model: string;
  variant_color: string | null;
  variant_size: string | null;
  available_count: number;
}

const TRACKING_METHODS = [
  { value: "none", label: "None (quantity-based)", hint: "Accessories, cases, chargers - tracked by count, optionally by barcode." },
  { value: "serial", label: "Serial Number", hint: "Phones/devices without a SIM slot." },
  { value: "imei", label: "IMEI", hint: "Phones/devices with a SIM slot." },
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [vendorStock, setVendorStock] = useState<VendorStockRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [trackingMethod, setTrackingMethod] = useState("none");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [saving, setSaving] = useState(false);

  function loadProducts(search?: string) {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    api<Product[] | { results: Product[] }>(`/api/products/products/${qs}`)
      .then((data) => setProducts(Array.isArray(data) ? data : data.results))
      .catch(() => {});
  }

  useEffect(() => {
    loadProducts();
    api<VendorStockRow[]>("/api/products/tracking/stock-by-vendor/").then(setVendorStock).catch(() => {});
    api<Category[] | { results: Category[] }>("/api/products/categories/")
      .then((data) => setCategories(Array.isArray(data) ? data : data.results))
      .catch(() => {});
  }, []);

  function resetForm() {
    setName("");
    setBrand("");
    setSku("");
    setBarcode("");
    setCategoryId(null);
    setTrackingMethod("none");
    setCostPrice("");
    setSellingPrice("");
  }

  async function addProduct() {
    if (!name.trim() || !sku.trim()) {
      toast.error("Name and SKU are required.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/products/products/", {
        method: "POST",
        body: JSON.stringify({
          name,
          brand,
          sku,
          barcode: barcode || null,
          category: categoryId ? Number(categoryId) : null,
          tracking_method: trackingMethod,
          cost_price: costPrice || "0",
          selling_price: sellingPrice || "0",
        }),
      });
      toast.success("Product added.");
      resetForm();
      setAddOpen(false);
      loadProducts(query);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to add product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">Your catalog of phones and accessories.</p>
        </div>
        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button>Add Product</Button>} />
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Product</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. iPhone 15 128GB" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Brand (optional)</Label>
                  <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Apple" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>SKU</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. IPH-15-128" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Category (optional)</Label>
                  <SearchableSelect
                    value={categoryId}
                    onValueChange={setCategoryId}
                    options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                    placeholder="Select category"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>How is each unit tracked?</Label>
                <div className="grid grid-cols-3 gap-2">
                  {TRACKING_METHODS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTrackingMethod(t.value)}
                      title={t.hint}
                      className={`rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                        trackingMethod === t.value
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "hover:bg-accent"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {trackingMethod === "none" && (
                <div className="flex flex-col gap-2">
                  <Label>Barcode (optional)</Label>
                  <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or type barcode" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>Cost Price</Label>
                  <Input value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0.00" inputMode="decimal" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Selling Price</Label>
                  <Input value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="0.00" inputMode="decimal" />
                </div>
              </div>

              <Button onClick={addProduct} disabled={saving}>
                {saving ? "Saving..." : "Save Product"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Catalog</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input
            placeholder="Search by name, SKU, brand..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadProducts(query)}
            className="max-w-sm"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Selling</TableHead>
                <TableHead className="text-right">Available Units</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="size-6 opacity-50" />
                      <span>No products found - add one to start building your catalog.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.category_name ?? "-"}</TableCell>
                  <TableCell>
                    {p.tracking_method !== "none" ? (
                      <Badge variant="outline">{p.tracking_method}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">qty-based</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">Rs. {p.cost_price}</TableCell>
                  <TableCell className="text-right">Rs. {p.selling_price}</TableCell>
                  <TableCell className="text-right">
                    {p.tracking_method !== "none" ? p.tracking_units_count : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.flags.map((f) => (
                        <Badge key={f} variant="secondary">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Stock by Vendor (tracked units)</CardTitle>
        </CardHeader>
        <CardContent>
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
              {vendorStock.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="size-5 opacity-50" />
                      <span>No tracked stock yet.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {vendorStock.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{row.brand || "-"}</TableCell>
                  <TableCell>{row.model}</TableCell>
                  <TableCell>
                    {[row.variant_color, row.variant_size].filter(Boolean).join(" / ") || "-"}
                  </TableCell>
                  <TableCell>{row.supplier_name ?? "-"}</TableCell>
                  <TableCell className="text-right">{row.available_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
