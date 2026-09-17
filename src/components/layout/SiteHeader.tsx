import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { buttonClassName } from "@/components/ui/Button";

export async function SiteHeader({ active }: { active?: "search" | "bookings" | "login" } = {}) {
  const nav = await getTranslations("nav");
  const common = await getTranslations("common");
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/90">
      <div className="page-shell flex min-h-[4.25rem] items-center justify-between gap-3">
        <Link href="/" aria-label={`${common("appName")} · accueil`} className="inline-flex min-h-11 items-center text-foreground no-underline">
          <span className="font-display text-[1.45rem] leading-none tracking-[-.045em]">{common("appName")}</span>
        </Link>
        <nav aria-label={nav("mainNavigation")} className="flex items-center gap-1 sm:gap-2">
          <Link aria-label={nav("search")} aria-current={active === "search" ? "page" : undefined} href="/recherche" className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium transition-colors hover:bg-surface-alt ${active === "search" ? "text-verified" : "text-foreground"}`}>
            <span className="hidden sm:inline">{nav("search")}</span><span className="sm:hidden" aria-label={nav("search")}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></span>
          </Link>
          <Link aria-current={active === "bookings" ? "page" : undefined} href="/reserver" className={`hidden min-h-11 items-center rounded-full px-3 text-sm font-medium transition-colors hover:bg-surface-alt sm:inline-flex ${active === "bookings" ? "text-verified" : "text-foreground"}`}>{nav("myBookings")}</Link>
          <Link href="/connexion" aria-label={nav("login")} className={buttonClassName("secondary", "!min-h-10 !rounded-full !px-4 !py-2 !text-xs max-[374px]:!w-10 max-[374px]:!px-0 sm:!text-sm")}><span aria-hidden="true" className="min-[375px]:hidden"><svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="8" r="3.3"/><path d="M5.5 20c.8-3.7 3-5.4 6.5-5.4s5.7 1.7 6.5 5.4"/></svg></span><span className="max-[374px]:sr-only">{nav("login")}</span></Link>
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
