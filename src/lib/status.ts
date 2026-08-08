/** Single source of truth for status -> color, mirroring the mobile app's
 * AppSemanticColors.statusColor() so both apps agree on what "paid" etc. look like.
 * Replaces the per-page STATUS_VARIANT maps and hardcoded amber/red/green Tailwind
 * classes that used to live in invoices/page.tsx and customers/page.tsx. */
export type StatusTone = "success" | "warning" | "danger" | "neutral";

export function getStatusTone(status: string): StatusTone {
  switch (status) {
    case "paid":
      return "success";
    case "partially_paid":
      return "warning";
    case "overdue":
    case "cancelled":
      return "danger";
    case "draft":
    case "sent":
    default:
      return "neutral";
  }
}

export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success-container text-success border-transparent",
  warning: "bg-warning-container text-warning border-transparent",
  danger: "bg-danger-container text-danger border-transparent",
  neutral: "bg-neutral-status-container text-neutral-status border-transparent",
};
