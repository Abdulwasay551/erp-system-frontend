"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/** Shared From/To date-range filter bar - same shape as the ledger date filters on the
 * customer/supplier detail pages, reused here so every analytics view filters the same way. */
export function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onApply,
  presets,
}: {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onApply: () => void;
  presets?: { label: string; days: number }[];
}) {
  function applyPreset(days: number) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    onDateFromChange(from.toISOString().slice(0, 10));
    onDateToChange(to.toISOString().slice(0, 10));
    onApply();
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label className="text-xs">From</Label>
        <Input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} className="h-8 w-36" />
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">To</Label>
        <Input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} className="h-8 w-36" />
      </div>
      <Button size="sm" variant="outline" onClick={onApply}>
        Apply Filter
      </Button>
      {presets?.map((p) => (
        <Button key={p.label} size="sm" variant="ghost" onClick={() => applyPreset(p.days)}>
          {p.label}
        </Button>
      ))}
    </div>
  );
}
