import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const common = await getTranslations("common");
  const nav = await getTranslations("nav");
  const lang = (await getLocale()) === "en" ? "en" : "fr";
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="page-shell grid gap-10 py-12 sm:py-14 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/brand/ayostay-logo-horizontal-slogan-${lang}.svg`} alt={common("appName")} width={1278} height={326} className="h-10 w-auto" />
          <p className="mt-4 max-w-[40ch] text-sm leading-relaxed text-muted">{common("footerNote")}</p>
        </div>
        <nav aria-label={common("footerNavigation")} className="flex flex-wrap content-start gap-x-8 gap-y-3 text-sm md:justify-end">
          <Link className="quiet-link text-foreground" href="/recherche">{nav("search")}</Link>
          <Link className="quiet-link text-foreground" href="/reserver">{nav("myBookings")}</Link>
          <Link className="quiet-link text-foreground" href="/connexion">{nav("login")}</Link>
          <Link className="quiet-link text-foreground" href="/connexion">{nav("owner")}</Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="page-shell flex flex-col gap-1 py-5 text-xs text-muted sm:flex-row sm:justify-between">
          <p>{common("copyright", { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
}
