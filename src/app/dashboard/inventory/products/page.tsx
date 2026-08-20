"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError, Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Search } from "lucide-react";
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
import { Pagination } from "@/components/pagination";
import { SortableHead } from "@/components/sortable-head";
import { DeleteButton } from "@/components/delete-button";

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

interface ProductTrackingUnit {
  id: number;
  imei_number: string | null;
  serial_number: string | null;
  barcode: string | null;
  status: string;
}

interface ProductDetail extends Product {
  brand: string;
  barcode: string | null;
  description: string;
  tracking_units: ProductTrackingUnit[];
}

interface Category {
  id: number;
  name: string;
}

const TRACKING_METHODS = [
  { value: "none", label: "None (quantity-based)", hint: "Accessories, cases, chargers - tracked by count, optionally by barcode." },
  { value: "serial", label: "Serial Number", hint: "Phones/devices without a SIM slot." },
  { value: "imei", label: "IMEI", hint: "Phones/devices with a SIM slot." },
];

const PAGE_SIZE = 25;

export default function ProductsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [products, setProducts] = useState<Product[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("name");
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [trackingMethod, setTrackingMethod] = useState("none");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const [detailFor, setDetailFor] = useState<Product | null>(null);
  const [detailData, setDetailData] = useState<ProductDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function openDetail(p: Product) {
    setDetailFor(p);
    setDetailData(null);
    setLoadingDetail(true);
    try {
      const full = await api<ProductDetail>(`/api/products/products/${p.id}/`);
      setDetailData(full);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load product detail.");
      setDetailFor(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  function loadProducts() {
    const params = new URLSearchParams({ page: String(page), ordering });
    if (query) params.set("search", query);
    api<Paginated<Product>>(`/api/products/products/?${params}`)
      .then((data) => {
        setProducts(data.results);
        setCount(data.count);
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load products."));
  }

  useEffect(loadProducts, [page, ordering]);

  useEffect(() => {
    api<Category[] | { results: Category[] }>("/api/products/categories/")
      .then((data) => setCategories(Array.isArray(data) ? data : data.results))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load categories."));
  }, []);

  function resetForm() {
    setName("");
    setBrand("");
    setBarcode("");
    setCategoryId(null);
    setTrackingMethod("none");
    setCostPrice("");
    setSellingPrice("");
  }

  async function addProduct() {
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/products/products/", {
        method: "POST",
        body: JSON.stringify({
          name,
          brand,
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
      loadProducts();
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
          <DialogContent className="max-w-xl">
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

              <div className="flex flex-col gap-2">
                <Label>Category (optional)</Label>
                <SearchableSelect
                  value={categoryId}
                  onValueChange={setCategoryId}
                  options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                  placeholder="Select category"
                />
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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                loadProducts();
              }
            }}
            className="max-w-sm"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead field="sku" ordering={ordering} onSort={setOrdering}>
                  SKU
                </SortableHead>
                <SortableHead field="name" ordering={ordering} onSort={setOrdering}>
                  Name
                </SortableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <SortableHead field="selling_price" ordering={ordering} onSort={setOrdering} className="text-right">
                  Selling
                </SortableHead>
                <TableHead className="text-right">Available Units</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="size-6 opacity-50" />
                      <span>No products found - add one to start building your catalog.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {products.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => openDetail(p)}>
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
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    {admin && (
                      <DeleteButton
                        label={`Product ${p.name}`}
                        onDelete={() => api(`/api/products/products/${p.id}/`, { method: "DELETE" })}
                        onDeleted={loadProducts}
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

      <Dialog open={detailFor !== null} onOpenChange={(open) => !open && setDetailFor(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailFor?.name}</DialogTitle>
          </DialogHeader>
          {loadingDetail || !detailData ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading...
            </div>
          ) : (
            <div className="flex flex-col gap-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <span>SKU: <span className="font-mono text-foreground">{detailData.sku}</span></span>
                <span>Brand: <span className="text-foreground">{detailData.brand || "-"}</span></span>
                <span>Barcode: <span className="text-foreground">{detailData.barcode || "-"}</span></span>
                <span>Category: <span className="text-foreground">{detailData.category_name || "-"}</span></span>
                <span>Cost: <span className="text-foreground">Rs. {detailData.cost_price}</span></span>
                <span>Selling: <span className="text-foreground">Rs. {detailData.selling_price}</span></span>
              </div>
              {detailData.description && <p className="text-muted-foreground">{detailData.description}</p>}
              {detailData.tracking_method !== "none" && (
                <div className="flex flex-col gap-1">
                  <Label>Tracking Units ({detailData.tracking_units.length})</Label>
                  {detailData.tracking_units.length === 0 ? (
                    <p className="text-muted-foreground">No units received yet.</p>
                  ) : (
                    <div className="flex flex-col gap-1 rounded-md border p-2">
                      {detailData.tracking_units.map((unit) => (
                        <div key={unit.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {unit.status !== "available" ? `(${unit.status}) ` : ""}
                          </span>
                          {/* Read-only here - editing a unit's code is only offered on the Vendor
                              Bill/receiving detail view, where it was actually just received, not
                              from this general catalog browsing view. */}
                          <span>{unit.imei_number || unit.serial_number || unit.barcode || "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
