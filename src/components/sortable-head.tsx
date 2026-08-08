"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Clickable column header wired to a DRF ?ordering= param. `ordering` is the current
 * raw query value (e.g. "-invoice_date"); clicking toggles asc -> desc -> asc for this
 * field. */
export function SortableHead({
  field,
  ordering,
  onSort,
  className,
  children,
}: {
  field: string;
  ordering: string;
  onSort: (ordering: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const active = ordering === field || ordering === `-${field}`;
  const desc = ordering === `-${field}`;

  function handleClick() {
    onSort(active && !desc ? `-${field}` : field);
  }

  return (
    <TableHead className={cn("cursor-pointer select-none", className)} onClick={handleClick}>
      <span className="inline-flex items-center gap-1">
        {children}
        {active ? (
          desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />
        ) : (
          <ArrowUpDown className="size-3.5 opacity-30" />
        )}
      </span>
    </TableHead>
  );
}
