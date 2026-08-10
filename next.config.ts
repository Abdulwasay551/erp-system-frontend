import type { NextConfig } from "next";

// The desktop (Tauri) build needs a static export - no Node server bundled, just HTML/JS
// served from the local filesystem/webview. The web (Vercel) build keeps its normal
// server-rendered output. Same codebase, same next.config.ts - just a build-time flag,
// per the desktop app plan's "same Next.js codebase, not a fork" decision.
const isDesktopBuild = process.env.NEXT_PUBLIC_IS_DESKTOP === "true";

const nextConfig: NextConfig = {
  ...(isDesktopBuild && {
    output: "export",
    // next/image's built-in optimizer needs a running Node server, incompatible with a
    // static export. Only used for a few fixed-size local logo assets, so this is a
    // zero-risk trade - there's nothing dynamic-sized to lose the optimizer for.
    images: { unoptimized: true },
  }),
};

export default nextConfig;
