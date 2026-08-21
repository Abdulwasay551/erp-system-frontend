import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}) {
  const color = tone === "positive" ? "text-success" : tone === "negative" ? "text-danger" : "";
  const badgeColor =
    tone === "positive" ? "bg-success-container text-success" : tone === "negative" ? "bg-danger-container text-danger" : "bg-primary/10 text-primary";
  return (
    <Card className="h-full">
      <CardContent className="flex items-center gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", badgeColor)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className={`text-xl font-semibold ${color}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
