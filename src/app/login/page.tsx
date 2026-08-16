"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fadeInUp } from "@/lib/motion";

const DEFAULT_PRODUCTION_URL = "https://erp-system-seven-eosin.vercel.app";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Desktop-only first-run bootstrap: a brand-new install's local database has no
  // users at all yet, so there's nothing to log in as - this computer has to be
  // paired with production BEFORE the normal login form means anything. See
  // core.api_views.desktop_setup_status/pair_desktop_with_production's own
  // docstrings for why pairing itself is reachable without a local login here.
  const [isDesktop, setIsDesktop] = useState(false);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [backendUnreachable, setBackendUnreachable] = useState(false);
  const [setupProductionUrl, setSetupProductionUrl] = useState(DEFAULT_PRODUCTION_URL);
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [pairing, setPairing] = useState(false);
  const [waitingForFirstSync, setWaitingForFirstSync] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_IS_DESKTOP !== "true") return;
    setIsDesktop(true);
    let cancelled = false;
    // A few retries with a short delay, not just one attempt - the splash screen
    // already waits for the backend's TCP port before showing this page at all, so a
    // genuine failure here is rare, but worth a couple retries before concluding
    // anything. Falling straight through to the normal login form on the first
    // failure (as this used to) is actively misleading: that form can never work
    // against a fresh/empty local database, and shows zero indication anything's
    // actually wrong - a shop owner would just see "wrong password" forever with no
    // way to tell the real problem is "the app can't talk to itself."
    async function checkSetupStatus(attemptsLeft: number) {
      try {
        const data = await api<{ needs_setup: boolean }>("/api/core/desktop-setup-status/", { auth: false });
        if (!cancelled) setNeedsSetup(data.needs_setup);
      } catch {
        if (cancelled) return;
        if (attemptsLeft > 0) {
          setTimeout(() => checkSetupStatus(attemptsLeft - 1), 1500);
        } else {
          setBackendUnreachable(true);
        }
      }
    }
    checkSetupStatus(5);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleSetupSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSetupError(null);
    if (!setupProductionUrl || !setupEmail || !setupPassword) {
      setSetupError("Production URL, email, and password are all required.");
      return;
    }
    setPairing(true);
    try {
      await api("/api/core/pair-with-production/", {
        auth: false,
        method: "POST",
        body: JSON.stringify({
          production_url: setupProductionUrl,
          email: setupEmail,
          password: setupPassword,
        }),
      });
      setSetupPassword("");
      setWaitingForFirstSync(true);
      // The background sync loop (already running since the backend booted) picks
      // this pairing up on its own within seconds and pulls the full first snapshot
      // down - poll the same unauthenticated status check until that local data
      // actually exists, rather than needing a second unauthenticated "sync now"
      // trigger endpoint.
      pollRef.current = setInterval(async () => {
        try {
          const status = await api<{ needs_setup: boolean }>("/api/core/desktop-setup-status/", { auth: false });
          if (!status.needs_setup) {
            if (pollRef.current) clearInterval(pollRef.current);
            setWaitingForFirstSync(false);
            setNeedsSetup(false);
            setEmail(setupEmail);
          }
        } catch {
          // transient - keep polling
        }
      }, 3000);
    } catch (err) {
      setSetupError(err instanceof ApiError ? err.message : "Failed to pair with production.");
      setPairing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isDesktop && backendUnreachable) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/40 p-4">
        <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="w-full max-w-sm">
          <Card className="w-full">
            <CardHeader className="items-center text-center">
              <CardTitle>Can&apos;t Reach the Local App Engine</CardTitle>
              <CardDescription>
                This computer&apos;s local backend isn&apos;t responding. Try closing Mobile
                Corner ERP completely and reopening it. If this keeps happening, your antivirus
                or firewall may be blocking the app from talking to itself on 127.0.0.1:8010 -
                add an exception for Mobile Corner ERP and try again.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (isDesktop && needsSetup === null) {
    // Still checking (or retrying) - deliberately blank rather than showing the
    // normal login form for a moment and then yanking it away for the setup screen,
    // which would be a confusing flash on a genuinely fresh install.
    return <div className="flex flex-1 items-center justify-center bg-muted/40 p-4" />;
  }

  if (isDesktop && needsSetup) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/40 p-4">
        <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="w-full max-w-sm">
          <Card className="w-full">
            <CardHeader className="items-center text-center">
              <div className="relative mb-2 flex size-24 items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "radial-gradient(circle, color-mix(in srgb, var(--primary) 25%, transparent) 0%, transparent 70%)",
                  }}
                />
                <Image src="/logo.jpg" alt="Mobile Corner" width={64} height={64} className="relative rounded-full" />
              </div>
              <CardTitle>Set Up This Computer</CardTitle>
              <CardDescription>
                First time running the desktop app - sign in with your production account once to pull
                your shop&apos;s data down.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {waitingForFirstSync ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                  <p className="text-sm text-muted-foreground">
                    Paired - downloading your shop&apos;s data now. This can take a minute the first time.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSetupSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="setup-url">Production URL</Label>
                    <Input
                      id="setup-url"
                      value={setupProductionUrl}
                      onChange={(e) => setSetupProductionUrl(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="setup-email">Email</Label>
                    <Input
                      id="setup-email"
                      type="email"
                      autoComplete="email"
                      value={setupEmail}
                      onChange={(e) => setSetupEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="setup-password">Password</Label>
                    <Input
                      id="setup-password"
                      type="password"
                      autoComplete="current-password"
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      required
                    />
                  </div>
                  {setupError && <p className="text-sm text-destructive">{setupError}</p>}
                  <Button type="submit" disabled={pairing} className="w-full">
                    {pairing ? "Pairing..." : "Pair & Download Data"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="w-full max-w-sm">
      <Card className="w-full">
        <CardHeader className="items-center text-center">
          <div className="relative mb-2 flex size-24 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle, color-mix(in srgb, var(--primary) 25%, transparent) 0%, transparent 70%)",
              }}
            />
            <Image
              src="/logo.jpg"
              alt="Mobile Corner"
              width={64}
              height={64}
              className="relative rounded-full"
            />
          </div>
          <CardTitle>Mobile Corner ERP</CardTitle>
          <CardDescription>Sign in to your shop account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
}
