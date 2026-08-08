import type { CurrentUser } from "./auth-context";

/** Owner/Manager-only actions (delete, recycle bin, staff management) - mirrors the
 * backend's IsOwnerOrManager permission class. Backend enforces this regardless; this
 * is purely for hiding/disabling the UI for roles that would just get a 403. */
export function isAdmin(user: CurrentUser | null): boolean {
  return user?.role_name === "Owner" || user?.role_name === "Manager";
}
