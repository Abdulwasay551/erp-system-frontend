import Link from "next/link";
import type { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ModuleLinkCard({
  href,
  icon: Icon,
  title,
  description,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: ReactNode;
}) {
  return (
    <Link href={href}>
      <Card className="relative transition-colors hover:border-primary/50 hover:bg-accent/50">
        <CardContent className="flex items-start gap-3 pt-6">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{title}</p>
              {badge}
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
