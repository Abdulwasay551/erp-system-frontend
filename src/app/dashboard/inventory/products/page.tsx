"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ApiError, Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Pencil } from "lucide-react";
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
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("name");
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [trackingMethod, setTrackingMethod] = useState("none");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [saving, setSaving] = useState(false);

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
    setEditingId(null);
    setName("");
    setBrand("");
    setBarcode("");
    setCategoryId(null);
    setTrackingMethod("none");
    setCostPrice("");
    setSellingPrice("");
  }

  function openAdd() {
    resetForm();
    setFormOpen(true);
  }

  async function openEdit(p: Product) {
    setEditingId(p.id);
    setName(p.name);
    setTrackingMethod(p.tracking_method);
    setCostPrice(p.cost_price);
    setSellingPrice(p.selling_price);
    setCategoryId(null);
    setBrand("");
    setBarcode("");
    setFormOpen(true);
    setLoadingEdit(true);
    try {
      const full = await api<{ brand: string; barcode: string | null; category: number | null }>(
        `/api/products/products/${p.id}/`
      );
      setBrand(full.brand ?? "");
      setBarcode(full.barcode ?? "");
      setCategoryId(full.category ? String(full.category) : null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load product details.");
    } finally {
      setLoadingEdit(false);
    }
  }

  async function saveProduct() {
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name,
        brand,
        barcode: barcode || null,
        category: categoryId ? Number(categoryId) : null,
        tracking_method: trackingMethod,
        cost_price: costPrice || "0",
        selling_price: sellingPrice || "0",
      };
      if (editingId) {
        await api(`/api/products/products/${editingId}/`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success("Product updated.");
      } else {
        await api("/api/products/products/", { method: "POST", body: JSON.stringify(body) });
        toast.success("Product added.");
      }
      resetForm();
      setFormOpen(false);
      loadProducts();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to save product.");
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
          open={formOpen}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button onClick={openAdd}>Add Product</Button>} />
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Product" : "Add Product"}</DialogTitle>
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

              <Button onClick={saveProduct} disabled={saving || loadingEdit}>
                {saving ? "Saving..." : loadingEdit ? "Loading..." : "Save Product"}
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
                <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/inventory/products/detail?id=${p.id}`)}>
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
                  <TableCell className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                      <Pencil className="size-3.5" />
                    </Button>
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
    </div>
  );
}
