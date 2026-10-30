"use client";

import { Link, usePathname } from "@/i18n/navigation";

export type ConsoleNavItem = { href: string; label: string; exact?: boolean };

export function ConsoleNav({ items, label, className = "" }: { items: ConsoleNavItem[]; label: string; className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={`page-shell -mb-px flex gap-1 overflow-x-auto ${className}`}>
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors ${active ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
