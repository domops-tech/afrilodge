import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const common = await getTranslations("common");
  const nav = await getTranslations("nav");
  return <footer className="mt-auto border-t border-border bg-surface-alt/60"><div className="page-shell flex flex-col justify-between gap-4 py-7 text-sm text-muted sm:flex-row sm:items-center"><p>{common("appName")} <span aria-hidden="true">·</span> {common("footerNote")}</p><nav aria-label={common("footerNavigation")} className="flex flex-wrap gap-x-5 gap-y-2"><Link className="quiet-link" href="/recherche">{nav("search")}</Link><Link className="quiet-link" href="/reserver">{nav("myBookings")}</Link><Link className="quiet-link" href="/connexion">{nav("login")}</Link></nav></div></footer>;
}
