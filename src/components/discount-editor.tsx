"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface DiscountEntry {
  type: "fixed" | "percent" | "per_unit";
  value: string;
}

const DISCOUNT_TYPE_LABELS: Record<DiscountEntry["type"], string> = {
  fixed: "Fixed amount",
  percent: "Percent",
  per_unit: "Per unit",
};

const DISCOUNT_TYPES = Object.keys(DISCOUNT_TYPE_LABELS) as DiscountEntry["type"][];

/** Mirrors core/pricing.py's compute_line_discount exactly, so the UI can preview the
 * backend-computed total before submitting: sum every fixed/per_unit discount first
 * (capped at the base amount), then apply every percent discount to what's left. */
export function computeDiscountTotal(baseAmount: number, quantity: number, discounts: DiscountEntry[]): number {
  let flatOff = 0;
  const percents: number[] = [];
  for (const d of discounts) {
    const val = Number(d.value) || 0;
    if (d.type === "fixed") flatOff += val;
    else if (d.type === "per_unit") flatOff += val * quantity;
    else if (d.type === "percent") percents.push(val);
  }
  flatOff = Math.min(flatOff, baseAmount);
  let remaining = baseAmount - flatOff;
  let percentOff = 0;
  for (const p of percents) {
    const off = remaining * (p / 100);
    percentOff += off;
    remaining -= off;
  }
  return Math.min(flatOff + percentOff, baseAmount);
}

interface DiscountEditorProps {
  value: DiscountEntry[];
  onChange: (entries: DiscountEntry[]) => void;
}

export function DiscountEditor({ value, onChange }: DiscountEditorProps) {
  function updateEntry(index: number, patch: Partial<DiscountEntry>) {
    onChange(value.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  function removeEntry(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }
  function addEntry() {
    onChange([...value, { type: "fixed", value: "" }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 && <p className="text-xs text-muted-foreground">No discounts added.</p>}
      {value.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <Select
            items={DISCOUNT_TYPE_LABELS}
            value={entry.type}
            onValueChange={(v) => v && updateEntry(i, { type: v as DiscountEntry["type"] })}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISCOUNT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {DISCOUNT_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={0}
            inputMode="decimal"
            placeholder={entry.type === "percent" ? "%" : "Rs."}
            value={entry.value}
            onChange={(e) => updateEntry(i, { value: e.target.value })}
            className="w-24"
          />
          <Button variant="ghost" size="sm" onClick={() => removeEntry(i)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addEntry}>
        <Plus className="size-3.5" /> Add discount
      </Button>
    </div>
  );
}
