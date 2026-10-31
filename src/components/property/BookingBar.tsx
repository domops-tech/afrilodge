"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { buttonClassName } from "@/components/ui/Button";

/** Barre de réservation fixe : n'apparaît qu'une fois l'écran d'ouverture dépassé (repère `#hero-end`). */
export function BookingBar({ title, price, label, href }: { title: string; price: string; label: string; href: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const marker = document.getElementById("hero-end");
    if (!marker) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    observer.observe(marker);
    return () => observer.disconnect();
  }, []);
  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground bg-background">
      <div className="page-shell flex items-center justify-between gap-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-serif text-lg leading-tight">{title}</p>
          <p className="text-sm tabular-nums text-muted">{price}</p>
        </div>
        <Link href={href} className={buttonClassName("primary", "shrink-0")}>{label}</Link>
      </div>
    </div>
  );
}
