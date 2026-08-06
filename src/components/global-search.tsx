"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";

interface SearchResult {
  type: string;
  id: number;
  number: string;
  label: string;
  subtitle: string;
}

const TYPE_LABEL: Record<string, string> = {
  invoice: "Invoice",
  bill: "Vendor Bill",
  credit_note: "Credit Note",
  payment: "Payment",
  purchase_payment: "Vendor Payment",
  product: "Product",
  customer: "Customer",
  supplier: "Supplier",
};

/** Where clicking a result of this type should land - highlight support only exists on
 * the invoices and all-bills pages so far; everything else just opens the list. */
function resultHref(r: SearchResult): string {
  switch (r.type) {
    case "invoice":
    case "credit_note":
    case "payment":
      return r.type === "invoice" ? `/dashboard/sales/invoices?highlight=${r.id}` : "/dashboard/sales/invoices";
    case "bill":
    case "purchase_payment":
      return r.type === "bill" ? `/dashboard/inventory/receiving/all?highlight=${r.id}` : "/dashboard/inventory/receiving/all";
    case "product":
      return "/dashboard/inventory/products";
    case "customer":
      return "/dashboard/contacts/customers";
    case "supplier":
      return "/dashboard/contacts/suppliers";
    default:
      return "/dashboard";
  }
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const handle = setTimeout(() => {
      setLoading(true);
      api<{ results: SearchResult[] }>(`/api/core/search/?q=${encodeURIComponent(query)}`)
        .then((data) => {
          setResults(data.results);
          setOpen(true);
        })
        .catch((e) => {
          if (!(e instanceof ApiError)) console.error(e);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  function goTo(r: SearchResult) {
    setOpen(false);
    setQuery("");
    router.push(resultHref(r));
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search invoices, products, customers..."
          className="h-8 w-full rounded-md border bg-background pl-8 pr-16 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          Ctrl K
        </kbd>
      </div>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-96 max-h-96 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Searching...
            </div>
          )}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">No matches for &quot;{query}&quot;.</p>
          )}
          {!loading &&
            query.trim().length >= 2 &&
            results.map((r) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => goTo(r)}
                className="flex w-full flex-col items-start gap-0.5 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-medium truncate">{r.label}</span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {TYPE_LABEL[r.type] ?? r.type}
                  </span>
                </span>
                {r.subtitle && <span className="text-xs text-muted-foreground truncate">{r.subtitle}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
