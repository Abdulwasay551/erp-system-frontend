"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";

/** Row-level delete action - Owner/Manager only (backend enforces regardless, callers
 * should only render this when lib/roles.ts's isAdmin(user) is true). Deletes are soft
 * (recycle bin) but immediately reverse stock/tracking/ledger side effects, so the
 * confirmation copy warns about that rather than implying it's a harmless no-op. */
export function DeleteButton({
  label,
  onDelete,
  onDeleted,
}: {
  label: string;
  onDelete: () => Promise<void>;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
      toast.success(`${label} moved to Recycle Bin.`);
      setOpen(false);
      onDeleted();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="destructive" size="sm">
            <Trash2 className="size-3.5" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {label}?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-destructive">
            This immediately reverses its effect on stock, tracking, and ledger balances - not just a display change.
          </p>
          <p className="text-sm text-muted-foreground">
            It moves to the Recycle Bin and can be restored later (which correctly re-applies those effects), or permanently purged from there.
          </p>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
