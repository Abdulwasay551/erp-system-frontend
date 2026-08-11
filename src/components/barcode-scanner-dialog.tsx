"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { CameraOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
  title?: string;
  description?: string;
}

/**
 * Camera-based barcode/QR scanner dialog. Mirrors the mobile app's
 * BarcodeScannerScreen contract: opens, scans once, hands back the raw
 * decoded string, and closes itself.
 */
export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onScan,
  title = "Scan Barcode",
  description = "Point the camera at a barcode or QR code.",
}: BarcodeScannerDialogProps) {
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    handledRef.current = false;
    setError(null);

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;

      const scanner = new Html5Qrcode(regionId, { verbose: false });
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            if (handledRef.current) return;
            handledRef.current = true;
            onScan(decodedText);
            onOpenChange(false);
          },
          () => {
            // Per-frame decode failure - expected while aiming, ignore.
          }
        );
      } catch {
        if (!cancelled) {
          setError("Could not access camera. Check permissions and try again.");
        }
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {
            // Already stopped/never started - safe to ignore.
          });
      }
    };
  }, [open, regionId, onScan, onOpenChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) toast.dismiss();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <CameraOff className="size-8" />
            <p>{error}</p>
          </div>
        ) : (
          <div id={regionId} className="w-full overflow-hidden rounded-lg [&_video]:w-full" />
        )}
      </DialogContent>
    </Dialog>
  );
}
