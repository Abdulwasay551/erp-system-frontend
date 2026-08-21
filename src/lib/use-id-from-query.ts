"use client";

import { useSearchParams } from "next/navigation";

/**
 * Shared convention for every full-page detail/edit/return view: the id comes from
 * `?id=` in the query string, not a dynamic route segment. The desktop (Tauri) build
 * uses Next.js static export (see next.config.ts), which can't serve dynamic
 * `[id]/page.tsx` segments for arbitrary runtime database ids - every one of these pages
 * is a plain static route reading its id the same way the existing `?highlight=`
 * cross-links already do.
 */
export function useIdFromQuery(): number | null {
  const searchParams = useSearchParams();
  const raw = searchParams.get("id");
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}
