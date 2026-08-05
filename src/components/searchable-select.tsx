"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  value: string | null;
  onValueChange: (value: string | null) => void;
  options: SearchableSelectOption[];
  /** Debounced callback fired as the user types - use it to hit a server `?search=` endpoint. */
  onSearch?: (query: string) => void;
  placeholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Type-to-search combobox built on Base UI's Combobox primitive. Client-side filters
 * `options` by default; pass `onSearch` to switch to server-side search (e.g. once a
 * list can grow into the hundreds, like suppliers/products) - the built-in filter is
 * disabled in that mode since the parent is expected to replace `options` itself.
 */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  onSearch,
  placeholder = "Search...",
  emptyText = "No results found.",
  loading = false,
  disabled = false,
  className,
}: SearchableSelectProps) {
  const selected = React.useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInputValueChange(query: string) {
    if (!onSearch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearch(query), 250);
  }

  return (
    <Combobox<SearchableSelectOption>
      items={options}
      value={selected}
      onValueChange={(item) => onValueChange(item ? item.value : null)}
      itemToStringLabel={(item) => item?.label ?? ""}
      isItemEqualToValue={(a, b) => a?.value === b?.value}
      onInputValueChange={handleInputValueChange}
      filter={onSearch ? null : undefined}
      disabled={disabled}
    >
      <ComboboxInput placeholder={placeholder} className={cn("w-full", className)} />
      <ComboboxContent>
        <ComboboxEmpty>
          <span className="flex items-center gap-2 text-muted-foreground">
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Search className="size-3.5" />
            )}
            {loading ? "Searching..." : emptyText}
          </span>
        </ComboboxEmpty>
        <ComboboxList>
          {(item: SearchableSelectOption) => (
            <ComboboxItem key={item.value} value={item}>
              <div className="flex flex-col">
                <span>{item.label}</span>
                {item.description && (
                  <span className="text-xs text-muted-foreground">{item.description}</span>
                )}
              </div>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
