"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api, ApiError, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fadeInUp } from "@/lib/motion";
import { CloudOff, DatabaseBackup, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";

interface SyncStatus {
  paired: boolean;
  production_url?: string;
  last_synced_at?: string | null;
  auth_required?: boolean;
  last_result?: { status: string; reason?: string; objects_imported?: number } | null;
}

const DEFAULT_PRODUCTION_URL = "https://erp-system-seven-eosin.vercel.app";

export default function DesktopSyncSettingsPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [isDesktop, setIsDesktop] = useState(false);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [productionUrl, setProductionUrl] = useState(DEFAULT_PRODUCTION_URL);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pairing, setPairing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState<"json" | "excel" | null>(null);

  useEffect(() => {
    setIsDesktop(process.env.NEXT_PUBLIC_IS_DESKTOP === "true");
  }, []);

  function loadStatus() {
    api<SyncStatus>("/api/core/sync-status/")
      .then(setStatus)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load sync status."));
  }

  useEffect(() => {
    if (isDesktop) loadStatus();
  }, [isDesktop]);

  async function pair() {
    if (!productionUrl || !email || !password) {
      toast.error("Production URL, email, and password are all required.");
      return;
    }
    setPairing(true);
    try {
      await api("/api/core/pair-with-production/", {
        method: "POST",
        body: JSON.stringify({ production_url: productionUrl, email, password }),
      });
      toast.success("Paired with production - auto-sync is now active.");
      setPassword("");
      loadStatus();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to pair with production.");
    } finally {
      setPairing(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    try {
      const result = await api<{ status: string; objects_imported?: number; reason?: string }>(
        "/api/core/sync-now/",
        { method: "POST" }
      );
      if (result.status === "synced") {
        toast.success(`Synced - ${result.objects_imported ?? 0} record(s) updated.`);
      } else if (result.status === "skipped") {
        toast.info(result.reason === "offline" ? "No connection to production right now." : "Sync skipped.");
      } else if (result.status === "auth_required") {
        toast.error("Your production login has expired - pair again below.");
      }
      loadStatus();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function downloadBackup(format: "json" | "excel") {
    setDownloadingBackup(format);
    try {
      if (format === "json") {
        await downloadFile("/api/core/export-backup/", "mobile-corner-backup.json");
      } else {
        await downloadFile("/api/core/export-backup/excel/", "mobile-corner-backup.xlsx");
      }
      toast.success("Backup downloaded - move it to a USB drive or cloud folder for safekeeping.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to download backup.");
    } finally {
      setDownloadingBackup(null);
    }
  }

  if (!isDesktop) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold">Desktop Sync</h1>
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            This page only applies to the Windows desktop app - you&apos;re viewing the web version.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold">Desktop Sync</h1>
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Owner/Manager only.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Desktop Sync</h1>
        <p className="text-sm text-muted-foreground">
          Keeps this computer&apos;s local copy fresh from production whenever it can reach the internet.
        </p>
      </div>

      <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              {status?.paired ? (
                status.auth_required ? (
                  <>
                    <TriangleAlert className="size-4 text-warning" /> Login expired
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4 text-success" /> Paired with production
                  </>
                )
              ) : (
                <>
                  <CloudOff className="size-4 text-muted-foreground" /> Not paired yet
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {status?.paired && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant="outline">{status.production_url}</Badge>
                <span className="text-muted-foreground">
                  Last synced:{" "}
                  {status.last_synced_at ? new Date(status.last_synced_at).toLocaleString() : "never yet"}
                </span>
              </div>
            )}

            {status?.auth_required && (
              <p className="text-sm text-warning">
                Your saved production login stopped working (it may have expired after this machine was
                offline for a while). Enter your production credentials again below to resume auto-sync.
              </p>
            )}

            {status?.paired && !status.auth_required && (
              <Button onClick={syncNow} disabled={syncing} className="w-fit">
                <RefreshCw className={syncing ? "size-3.5 animate-spin" : "size-3.5"} />
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
            )}

            {(!status?.paired || status?.auth_required) && (
              <div className="flex flex-col gap-3 max-w-md">
                <div className="flex flex-col gap-2">
                  <Label>Production URL</Label>
                  <Input value={productionUrl} onChange={(e) => setProductionUrl(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button onClick={pair} disabled={pairing} className="w-fit">
                  {pairing ? "Pairing..." : "Pair with Production"}
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground border-t pt-3">
              Changes made here on the desktop app stay on this computer until push-back sync ships - they
              won&apos;t appear on the web dashboard or other devices yet. This page only pulls the latest
              data down from production.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <DatabaseBackup className="size-4" /> Disaster Recovery Backup
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Download a full snapshot of every company&apos;s data on this system - keep a copy on a USB
              drive or cloud folder in case production&apos;s database is ever lost. If that happens, this
              file can seed a brand-new backend from scratch. Only available to superuser accounts.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => downloadBackup("json")}
                disabled={downloadingBackup !== null}
              >
                {downloadingBackup === "json" ? "Downloading..." : "Download Backup (.json)"}
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadBackup("excel")}
                disabled={downloadingBackup !== null}
              >
                {downloadingBackup === "excel" ? "Downloading..." : "Download Backup (.xlsx, for review)"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
