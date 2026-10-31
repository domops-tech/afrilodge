import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const navLink = "caps min-h-11 items-center border-b border-transparent text-foreground transition-colors hover:border-foreground";

export async function SiteHeader({ active }: { active?: "search" | "bookings" | "login" } = {}) {
  const nav = await getTranslations("nav");
  const common = await getTranslations("common");
  const logo = (await getLocale()) === "en" ? "en" : "fr";
  const current = (name: "search" | "bookings") => (active === name ? "!border-foreground" : "");
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="page-shell flex min-h-[4.25rem] items-center justify-between gap-4 lg:min-h-[4.75rem]">
        <Link href="/" aria-label={`${common("appName")} · accueil`} className="inline-flex min-h-11 shrink-0 items-center text-foreground no-underline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/brand/ayostay-logo-horizontal-slogan-${logo}.svg`} alt={common("appName")} width={1278} height={326} className="h-9 w-auto lg:h-11" />
        </Link>
        <nav aria-label={nav("mainNavigation")} className="flex items-center justify-end gap-1 sm:gap-6 lg:gap-9">
          <Link href="/recherche" aria-label={nav("search")} aria-current={active === "search" ? "page" : undefined} className={`${navLink} ${current("search")} inline-flex max-lg:size-11 max-lg:justify-center`}>
            <span className="max-lg:hidden">{nav("search")}</span>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5 lg:hidden" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
          </Link>
          <Link href="/reserver" aria-current={active === "bookings" ? "page" : undefined} className={`${navLink} ${current("bookings")} hidden sm:inline-flex`}>{nav("myBookings")}</Link>
          <Link href="/connexion" aria-label={nav("login")} className={`${navLink} inline-flex max-[479px]:w-11 max-[479px]:justify-center`}>
            <span aria-hidden="true" className="min-[480px]:hidden"><svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="8" r="3.3" /><path d="M5.5 20c.8-3.7 3-5.4 6.5-5.4s5.7 1.7 6.5 5.4" /></svg></span>
            <span className="max-[479px]:sr-only">{nav("login")}</span>
          </Link>
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
