import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/client";
import { getOptionalSession } from "@/lib/auth/guard";
import type { UserRole } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/logout-action";
import { Button } from "@/components/ui/Button";
import { ConsoleNav, type ConsoleNavItem } from "./ConsoleNav";

const AREAS = {
  OWNER: { labelKey: "owner", home: "/proprietaire", width: "max-w-[68rem]" },
  AGENT: { labelKey: "field", home: "/terrain", width: "max-w-[44rem]" },
  ADMIN: { labelKey: "admin", home: "/admin", width: "max-w-[72rem]" },
} as const;

export async function ConsoleShell({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const [nav, common, locale, session] = await Promise.all([
    getTranslations("nav"),
    getTranslations("common"),
    getLocale(),
    getOptionalSession(),
  ]);
  const area = AREAS[role];
  const logo = locale === "en" ? "en" : "fr";
  const user = session?.kind === "user" && session.role === role
    ? await prisma.user.findUnique({ where: { id: session.userId }, select: { fullName: true } })
    : null;

  const items: ConsoleNavItem[] = role === "ADMIN"
    ? [
        { href: "/admin", label: nav("toProcess"), exact: true },
        { href: "/admin/litiges", label: nav("disputes") },
        { href: "/admin/agents", label: nav("agents") },
        { href: "/admin/commissions", label: nav("commissions") },
        { href: "/admin/parametres", label: nav("settings") },
      ]
    : [];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-background">
        <div className={`page-shell flex min-h-[4rem] items-center justify-between gap-3 ${area.width}`}>
          <div className="flex min-w-0 items-center gap-3">
            <Link href={area.home} aria-label={common("appName")} className="inline-flex min-h-11 shrink-0 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/brand/ayostay-logo-horizontal-slogan-${logo}.svg`} alt={common("appName")} width={1278} height={326} className="h-8 w-auto sm:h-9" />
            </Link>
            <span className="truncate rounded-full bg-surface-alt px-3 py-1 text-xs font-semibold text-foreground">{nav(area.labelKey)}</span>
          </div>
          {user ? (
            <div className="flex shrink-0 items-center gap-1 sm:gap-3">
              <span className="hidden max-w-[16rem] truncate text-sm text-muted sm:inline">{user.fullName}</span>
              <form action={logoutAction}>
                <input type="hidden" name="locale" value={locale} />
                <Button type="submit" variant="ghost" className="!min-h-10 !px-3">{nav("logout")}</Button>
              </form>
            </div>
          ) : null}
        </div>
        {user && items.length ? <ConsoleNav items={items} label={nav("mainNavigation")} className={area.width} /> : null}
      </header>
      <main className={`console-main page-shell w-full flex-1 py-6 sm:py-8 ${area.width}`}>{children}</main>
    </div>
  );
}
