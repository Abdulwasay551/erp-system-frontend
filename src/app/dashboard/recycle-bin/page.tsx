"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { fadeInUp, staggerContainer } from "@/lib/motion";
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

interface RecycleBinItem {
  model: string;
  id: number;
  repr: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

interface RecycleBinResponse {
  results: RecycleBinItem[];
  count: number;
}

function formatModel(label: string) {
  const name = label.split(".").pop() ?? label;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function rowKey(item: RecycleBinItem) {
  return `${item.model}:${item.id}`;
}

export default function RecycleBinPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);

  if (!admin) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">Recycle Bin</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Owner/Manager only - you don&apos;t have access to the recycle bin.</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <RecycleBinContent />;
}

function RecycleBinContent() {
  const [items, setItems] = useState<RecycleBinItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [purgeFor, setPurgeFor] = useState<RecycleBinItem | null>(null);
  const [purging, setPurging] = useState(false);

  const [emptyOpen, setEmptyOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [emptying, setEmptying] = useState(false);

  function load() {
    setError(null);
    api<RecycleBinResponse>("/api/core/recycle-bin/")
      .then((data) => setItems(data.results))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load recycle bin."));
  }

  useEffect(load, []);

  async function restore(item: RecycleBinItem) {
    setBusy(rowKey(item));
    try {
      await api("/api/core/recycle-bin/restore/", {
        method: "POST",
        body: JSON.stringify({ model: item.model, id: item.id }),
      });
      toast.success(`${formatModel(item.model)} restored.`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to restore.");
    } finally {
      setBusy(null);
    }
  }

  async function purge() {
    if (!purgeFor) return;
    setPurging(true);
    try {
      await api("/api/core/recycle-bin/purge/", {
        method: "POST",
        body: JSON.stringify({ model: purgeFor.model, id: purgeFor.id }),
      });
      toast.success(`${formatModel(purgeFor.model)} permanently deleted.`);
      setPurgeFor(null);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to purge.");
    } finally {
      setPurging(false);
    }
  }

  async function emptyBin() {
    setEmptying(true);
    try {
      const result = await api<{ status: string; purged_count: number }>("/api/core/recycle-bin/empty/", {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast.success(`Recycle bin emptied - ${result.purged_count} item(s) permanently deleted.`);
      setEmptyOpen(false);
      setConfirmText("");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to empty recycle bin.");
    } finally {
      setEmptying(false);
    }
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="flex flex-col gap-6">
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Recycle Bin</h1>
          <p className="text-sm text-muted-foreground">
            Soft-deleted records - restore them or purge permanently.
          </p>
        </div>
        <Dialog
          open={emptyOpen}
          onOpenChange={(open) => {
            setEmptyOpen(open);
            if (!open) setConfirmText("");
          }}
        >
          <DialogTrigger
            render={
              <Button variant="destructive" disabled={!items || items.length === 0}>
                <Trash2 className="size-3.5" /> Empty Recycle Bin
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-destructive" /> Empty Recycle Bin?
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                This permanently deletes every item currently in the recycle bin ({items?.length ?? 0} item
                {items?.length === 1 ? "" : "s"}). This cannot be undone.
              </p>
              <div className="flex flex-col gap-2">
                <Label>
                  Type <span className="font-mono font-semibold">DELETE</span> to confirm
                </Label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                />
              </div>
              <Button
                variant="destructive"
                onClick={emptyBin}
                disabled={confirmText !== "DELETE" || emptying}
              >
                {emptying ? "Emptying..." : "Permanently Empty Recycle Bin"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      <motion.div variants={fadeInUp}>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{error ? error : "Deleted items"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Deleted At</TableHead>
                <TableHead>Deleted By</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items !== null && items.length === 0 && !error && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Trash2 className="size-6 opacity-50" />
                      <span>Recycle bin is empty.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {items?.map((item) => (
                <TableRow key={rowKey(item)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-status-container text-neutral-status">
                        <Trash2 className="size-3.5" />
                      </span>
                      <Badge variant="outline">{formatModel(item.model)}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{item.repr}</TableCell>
                  <TableCell>{item.deleted_at ? new Date(item.deleted_at).toLocaleString() : "-"}</TableCell>
                  <TableCell>{item.deleted_by ?? "-"}</TableCell>
                  <TableCell className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restore(item)}
                      disabled={busy === rowKey(item)}
                    >
                      <RotateCcw className="size-3.5" /> Restore
                    </Button>
                    <Dialog
                      open={purgeFor?.model === item.model && purgeFor?.id === item.id}
                      onOpenChange={(open) => !open && setPurgeFor(null)}
                    >
                      <DialogTrigger
                        render={
                          <Button variant="destructive" size="sm" onClick={() => setPurgeFor(item)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        }
                      />
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Permanently delete {formatModel(item.model)}?</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-3">
                          <p className="text-sm text-muted-foreground">
                            &quot;{item.repr}&quot; will be permanently deleted - unlike Delete elsewhere in the app,
                            this cannot be restored from the recycle bin afterwards.
                          </p>
                          <Button variant="destructive" onClick={purge} disabled={purging}>
                            {purging ? "Deleting..." : "Permanently Delete"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </motion.div>
    </motion.div>
  );
}
