"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * A small "i" info icon that explains a potentially-confusing term or figure on hover
 * (or tap, on touch devices) - e.g. what "Credit" means on a customer vs. supplier
 * ledger, or what "Outstanding" is computed from. Place right next to the label/value
 * it explains, not as a replacement for it.
 */
export function InfoTooltip({ children, className }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="More info"
            className={cn(
              "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-muted-foreground align-middle hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              className
            )}
          />
        }
      >
        <Info className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}
