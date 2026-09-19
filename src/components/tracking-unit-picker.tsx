"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AvailableUnit {
  id: number;
  tracking_identifier: { type: string; value: string } | null;
}

interface SelectedUnit {
  id: number;
  identifier: string;
}

interface TrackingUnitPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number;
  productName: string;
  onConfirm: (units: SelectedUnit[]) => void;
}

/**
 * Lets a user pick one or more specific IMEI/serial units already in stock for a
 * tracked product - used when adding a product to a sale by name search rather than by
 * scanning a specific unit (POS's scan-to-search flow already returns per-unit results).
 * Only units with status="available" are offered, matching the backend's own
 * availability check on submit.
 */
export function TrackingUnitPicker({
  open,
  onOpenChange,
  productId,
  productName,
  onConfirm,
}: TrackingUnitPickerProps) {
  const [query, setQuery] = useState("");
  const [units, setUnits] = useState<AvailableUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(new Map());
    load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId]);

  async function load(q: string) {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ product: String(productId), status: "available" });
      if (q.trim()) qs.set("search", q.trim());
      const data = await api<{ results: AvailableUnit[] } | AvailableUnit[]>(
        `/api/products/tracking/?${qs.toString()}`
      );
      setUnits(Array.isArray(data) ? data : data.results);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load available units.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(unit: AvailableUnit) {
    const identifier = unit.tracking_identifier?.value ?? `#${unit.id}`;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(unit.id)) next.delete(unit.id);
      else next.set(unit.id, identifier);
      return next;
    });
  }

  function confirm() {
    if (selected.size === 0) {
      toast.error("Select at least one unit.");
      return;
    }
    onConfirm(Array.from(selected.entries()).map(([id, identifier]) => ({ id, identifier })));
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select units &mdash; {productName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Search IMEI/serial..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(query)}
          />
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : units.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No available units in stock for this product.
            </p>
          ) : (
            <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
              {units.map((unit) => {
                const identifier = unit.tracking_identifier?.value ?? `#${unit.id}`;
                const checked = selected.has(unit.id);
                return (
                  <label
                    key={unit.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(unit)} />
                    <span className="font-mono">{identifier}</span>
                  </label>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {selected.size} unit{selected.size === 1 ? "" : "s"} selected.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={confirm}>
            Add {selected.size || ""} unit{selected.size === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
