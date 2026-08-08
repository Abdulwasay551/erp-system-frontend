import { Badge } from "@/components/ui/badge";
import { getStatusTone, STATUS_TONE_CLASSES } from "@/lib/status";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = getStatusTone(status);
  return (
    <Badge variant="outline" className={cn(STATUS_TONE_CLASSES[tone], className)}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
