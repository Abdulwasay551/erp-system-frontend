"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";

const FIELD_BY_METHOD: Record<string, string> = {
  imei: "imei_number",
  serial: "serial_number",
  barcode: "barcode",
  batch: "batch_number",
};

interface TrackingCodeEditorProps {
  id: number;
  code: string | null;
  status: string;
  trackingMethod: string;
  onSaved?: (newCode: string) => void;
}

/**
 * A tracking unit's code (IMEI/serial/barcode/batch), editable in place only while
 * the unit is still "available" - the backend (products.api_views.
 * ProductTrackingViewSet.perform_update) enforces the same rule, this just avoids
 * offering an edit control that would only fail once already sold.
 */
export function TrackingCodeEditor({ id, code, status, trackingMethod, onSaved }: TrackingCodeEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(code ?? "");
  const [saving, setSaving] = useState(false);
  const editable = status === "available";
  const field = FIELD_BY_METHOD[trackingMethod] ?? "imei_number";

  async function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("Code can't be empty.");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/products/tracking/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: trimmed }),
      });
      toast.success("Tracking code updated.");
      setEditing(false);
      onSaved?.(trimmed);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to update tracking code.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setValue(code ?? "");
              setEditing(false);
            }
          }}
          className="h-6 w-36 text-xs"
          disabled={saving}
        />
        <Button size="icon" variant="ghost" className="size-5" onClick={save} disabled={saving}>
          <Check className="size-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-5"
          disabled={saving}
          onClick={() => {
            setValue(code ?? "");
            setEditing(false);
          }}
        >
          <X className="size-3" />
        </Button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      {code ?? <span className="text-muted-foreground">&mdash;</span>}
      {editable && (
        <Button
          size="icon"
          variant="ghost"
          className="size-5"
          title="Correct this code"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-3" />
        </Button>
      )}
    </span>
  );
}
