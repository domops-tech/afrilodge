import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const common = await getTranslations("common");
  const nav = await getTranslations("nav");
  const legal = await getTranslations("legal");
  const lang = (await getLocale()) === "en" ? "en" : "fr";
  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="page-shell grid gap-10 py-12 sm:py-14 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/brand/ayostay-logo-horizontal-slogan-${lang}.svg`} alt={common("appName")} width={1278} height={326} className="h-10 w-auto" />
          <p className="lede mt-4 max-w-[40ch] !text-base text-muted">{common("footerNote")}</p>
        </div>
        <nav aria-label={common("footerNavigation")} className="caps flex flex-wrap content-start gap-x-8 gap-y-3 md:justify-end">
          <Link className="quiet-link text-foreground" href="/recherche">{nav("search")}</Link>
          <Link className="quiet-link text-foreground" href="/reserver">{nav("myBookings")}</Link>
          <Link className="quiet-link text-foreground" href="/connexion">{nav("login")}</Link>
          <Link className="quiet-link text-foreground" href="/connexion">{nav("owner")}</Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="page-shell flex flex-col gap-3 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>{common("copyright", { year: new Date().getFullYear() })}</p>
          <nav aria-label={legal("navLabel")} className="flex flex-wrap gap-x-6 gap-y-2">
            <Link className="quiet-link" href="/mentions-legales">{legal("notice")}</Link>
            <Link className="quiet-link" href="/conditions">{legal("terms")}</Link>
            <Link className="quiet-link" href="/confidentialite">{legal("privacy")}</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
