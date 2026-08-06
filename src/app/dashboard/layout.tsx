"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Building2,
  Landmark,
  Settings,
  LogOut,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { GlobalSearch } from "@/components/global-search";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavModule {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: { href: string; label: string }[];
}

const MODULES: NavModule[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  {
    href: "/dashboard/sales",
    label: "Sales",
    icon: ShoppingCart,
    children: [
      { href: "/dashboard/sales/pos", label: "POS / Sell" },
      { href: "/dashboard/sales/invoices", label: "Invoices" },
    ],
  },
  {
    href: "/dashboard/inventory",
    label: "Inventory",
    icon: Truck,
    children: [
      { href: "/dashboard/inventory/receiving/new", label: "New Vendor Invoice" },
      { href: "/dashboard/inventory/receiving/pending", label: "Pending Receipts" },
      { href: "/dashboard/inventory/products", label: "Products" },
    ],
  },
  {
    href: "/dashboard/contacts",
    label: "Contacts",
    icon: Building2,
    children: [
      { href: "/dashboard/contacts/customers", label: "Customers" },
      { href: "/dashboard/contacts/suppliers", label: "Suppliers" },
    ],
  },
  {
    href: "/dashboard/accounting",
    label: "Accounting",
    icon: Landmark,
    children: [
      { href: "/dashboard/accounting/profit", label: "Profit & Loss" },
      { href: "/dashboard/accounting/expenses", label: "Expenses" },
    ],
  },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

interface Crumb {
  label: string;
  href?: string;
}

// Falls back to matching by longest prefix (so e.g. /dashboard/inventory/receiving/all,
// which isn't one of the sidebar's own child links, still resolves to "Inventory /
// Vendor Bills" instead of just "Dashboard").
const EXTRA_LABELS: Record<string, string> = {
  "/dashboard/inventory/receiving": "Receiving",
  "/dashboard/inventory/receiving/all": "All Vendor Bills",
  "/dashboard/inventory/receiving/new": "New Vendor Invoice",
  "/dashboard/inventory/receiving/pending": "Pending Receipts",
};

function getBreadcrumbs(pathname: string): Crumb[] {
  if (pathname === "/dashboard") return [{ label: "Overview" }];

  for (const mod of MODULES) {
    if (mod.href === pathname) return [{ label: "Dashboard", href: "/dashboard" }, { label: mod.label }];
    const child = mod.children?.find((c) => c.href === pathname);
    if (child) {
      return [
        { label: "Dashboard", href: "/dashboard" },
        { label: mod.label, href: mod.href },
        { label: child.label },
      ];
    }
    if (pathname.startsWith(mod.href + "/")) {
      const label = EXTRA_LABELS[pathname] ?? pathname.split("/").pop()?.replace(/-/g, " ") ?? mod.label;
      return [
        { label: "Dashboard", href: "/dashboard" },
        { label: mod.label, href: mod.href },
        { label: label.charAt(0).toUpperCase() + label.slice(1) },
      ];
    }
  }
  return [{ label: "Dashboard", href: "/dashboard" }];
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const crumbs = getBreadcrumbs(pathname);
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5 min-w-0">
          {i > 0 && <span className="text-muted-foreground/50">/</span>}
          {crumb.href ? (
            <Link href={crumb.href} className="hover:text-foreground transition-colors truncate">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium truncate">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("erp_sidebar_collapsed") === "true";
  });

  function toggleCollapsed() {
    setCollapsed((prev) => {
      localStorage.setItem("erp_sidebar_collapsed", String(!prev));
      return !prev;
    });
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      <aside
        className={cn(
          "shrink-0 border-r bg-background flex flex-col transition-[width] duration-150",
          collapsed ? "w-14" : "w-60"
        )}
      >
        <div className="flex items-center gap-2 px-3 h-14 border-b">
          <Image
            src="/logo.jpg"
            alt="Mobile Corner"
            width={28}
            height={28}
            className="size-7 shrink-0 rounded-full object-contain"
          />
          {!collapsed && (
            <div className="leading-tight min-w-0">
              <p className="font-semibold text-sm truncate">Mobile Corner</p>
              <p className="text-[11px] text-muted-foreground truncate">ERP System</p>
            </div>
          )}
        </div>

        <nav className="flex flex-col gap-1 p-2 flex-1 overflow-visible">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            const isModuleActive =
              pathname === mod.href || mod.children?.some((c) => c.href === pathname);

            return (
              <div key={mod.href} className="group/module relative">
                <Link
                  href={mod.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                    isModuleActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{mod.label}</span>}
                </Link>

                {/* Expanded mode: sub-items shown inline */}
                {!collapsed && mod.children && (
                  <div className="ml-[1.6rem] mt-0.5 flex flex-col gap-0.5 border-l pl-2.5">
                    {mod.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "rounded-md px-2 py-1.5 text-sm transition-colors",
                          pathname === child.href
                            ? "text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Collapsed mode: flyout panel on hover */}
                {collapsed && mod.children && (
                  <div className="invisible absolute left-full top-0 z-50 ml-1 w-48 rounded-lg border bg-popover p-1.5 text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/module:visible group-hover/module:opacity-100">
                    <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{mod.label}</p>
                    {mod.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "block rounded-md px-2 py-1.5 text-sm",
                          pathname === child.href
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-accent"
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t p-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex w-full items-center gap-2.5 rounded-md p-2 text-left hover:bg-accent">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {initials(user?.first_name, user?.last_name)}
                  </div>
                  {!collapsed && (
                    <>
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-sm font-medium">
                          {user?.first_name} {user?.last_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{user?.role_name}</p>
                      </div>
                      <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                    </>
                  )}
                </button>
              }
            />
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem onClick={logout} variant="destructive">
                <LogOut className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
          <button
            onClick={toggleCollapsed}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
          <Breadcrumbs pathname={pathname} />
          <div className="ml-auto w-full max-w-sm">
            <GlobalSearch />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <DashboardShell>{children}</DashboardShell>
    </RequireAuth>
  );
}
