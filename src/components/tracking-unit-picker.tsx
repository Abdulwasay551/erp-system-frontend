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

interface ConflictUnit {
  id: number;
  status: string;
  product: number;
  product_name: string;
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
  trackingMethod: string;
  /** Pre-fill the search box - e.g. a barcode/IMEI just scanned before opening this. */
  initialQuery?: string;
  onConfirm: (units: SelectedUnit[]) => void;
}

const IMEI_LENGTH = 15;

/**
 * Lets a user pick one or more specific IMEI/serial units already in stock for a
 * tracked product - used both by POS (instead of silently attaching whichever unit a
 * name/scan search happened to match first) and by the invoice edit page's "add by
 * name" flow. Only units with status="available" are offered, matching the backend's
 * own availability check on submit - selection is always an explicit, deliberate step,
 * never automatic.
 *
 * Also validates IMEI format client-side (exactly 15 digits) before searching, and - if
 * a typed/scanned code matches no *available* unit for this product - runs a second,
 * unscoped lookup so the error explains why (wrong product, already sold/returned, or
 * genuinely not found) instead of just showing an empty list.
 */
export function TrackingUnitPicker({
  open,
  onOpenChange,
  productId,
  productName,
  trackingMethod,
  initialQuery,
  onConfirm,
}: TrackingUnitPickerProps) {
  const [query, setQuery] = useState("");
  const [units, setUnits] = useState<AvailableUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Map<number, string>>(new Map());
  const [formatError, setFormatError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(new Map());
    const q = initialQuery ?? "";
    setQuery(q);
    load(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId]);

  // Non-blocking hint only - searching by the last few digits of an IMEI is a normal,
  // deliberate way to find a unit (matched via substring on the backend), so a query
  // that isn't 15 digits must never prevent the search itself from running. Only warn
  // when the length is close enough to 15 that it looks like an attempted full IMEI
  // with a typo, not a genuine short/partial lookup.
  function checkFormat(q: string) {
    const trimmed = q.trim();
    const looksLikeAttempt = /^\d+$/.test(trimmed) && trimmed.length >= 10;
    setFormatError(
      trackingMethod === "imei" && looksLikeAttempt && trimmed.length !== IMEI_LENGTH
        ? `An IMEI must be exactly ${IMEI_LENGTH} digits (got ${trimmed.length}) - searching anyway as a partial match.`
        : null
    );
  }

  async function load(q: string) {
    setConflict(null);
    checkFormat(q);
    setLoading(true);
    try {
      const qs = new URLSearchParams({ product: String(productId), status: "available" });
      if (q.trim()) qs.set("search", q.trim());
      const data = await api<{ results: AvailableUnit[] } | AvailableUnit[]>(
        `/api/products/tracking/?${qs.toString()}`
      );
      const found = Array.isArray(data) ? data : data.results;
      setUnits(found);
      if (found.length === 0 && q.trim()) {
        await explainConflict(q.trim());
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load available units.");
    } finally {
      setLoading(false);
    }
  }

  /** A specific code was typed/scanned but matched no available unit for this product -
   * look it up without the product/status filter to explain why, instead of leaving the
   * user with just an empty list. */
  async function explainConflict(code: string) {
    try {
      const data = await api<{ results: ConflictUnit[] } | ConflictUnit[]>(
        `/api/products/tracking/?search=${encodeURIComponent(code)}`
      );
      const matches = Array.isArray(data) ? data : data.results;
      const exact = matches.find((m) => m.tracking_identifier?.value === code) ?? matches[0];
      if (!exact) {
        setConflict(`"${code}" was not found in tracking records at all.`);
      } else if (exact.product !== productId) {
        setConflict(`"${code}" belongs to a different product (${exact.product_name}), not ${productName}.`);
      } else {
        setConflict(`"${code}" is already ${exact.status} - it can't be sold again.`);
      }
    } catch {
      // Best-effort explanation only - the empty list above is still a correct result.
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
            placeholder={trackingMethod === "imei" ? "Scan or type a 15-digit IMEI..." : "Search serial/code..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(query)}
            autoFocus
          />
          {formatError && <p className="text-xs text-destructive">{formatError}</p>}
          {conflict && !formatError && <p className="text-xs text-destructive">{conflict}</p>}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : units.length === 0 ? (
            !conflict && !formatError && (
              <p className="text-sm text-muted-foreground">
                No available units in stock for this product.
              </p>
            )
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
