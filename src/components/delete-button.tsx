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
 * (recycle bin), never permanent, so the confirmation copy reflects that. */
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
          <p className="text-sm text-muted-foreground">
            This moves it to the Recycle Bin - it can be restored later, or permanently purged from there.
          </p>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
