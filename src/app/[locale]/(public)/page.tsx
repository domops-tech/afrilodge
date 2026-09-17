import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/client";
import { isVerificationValid } from "@/lib/verification/badge";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PropertyCard } from "@/components/property/PropertyCard";
import { VerificationNote } from "@/components/property/VerificationNote";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const search = await getTranslations("search");
  const common = await getTranslations("common");
  const where = { status: "PUBLISHED" as const, verification: { is: { status: "ACTIVE" as const, expiresAt: { gt: new Date() } } } };
  const homes = await prisma.property.findMany({ where, orderBy: { createdAt: "desc" }, take: 4, select: { id: true, isDemo: true, title: true, neighborhood: true, city: true, pricePerNight: true, maxGuests: true, verification: { select: { status: true, visitDate: true, expiresAt: true } } } });
  const featuredPhotos = homes.length ? await prisma.visitPhoto.findMany({ where: { slot: "FACADE", visit: { verification: { propertyId: { in: homes.map(home => home.id) } } } }, select: { storageKey: true, isDemoPlaceholder: true, visit: { select: { verification: { select: { propertyId: true } } } } } }) : [];
  const photoByProperty = new Map(featuredPhotos.map(photo => [photo.visit.verification?.propertyId, photo]));
  const featured = homes.filter(home => home.verification && isVerificationValid(home.verification));
  const firstVerified = featured.find(home => home.verification)?.verification ?? null;

  return <div className="flex min-h-screen flex-col"><SiteHeader />
    <div className="flex-1">
      <section className="overflow-hidden border-b border-border bg-[#f1f0e8]">
        <div className="page-shell grid min-h-[30rem] items-center gap-10 py-12 sm:py-16 lg:min-h-[33rem] lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,.8fr)] lg:gap-16 lg:py-20">
          <div className="max-w-[47rem]">
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="mt-4 max-w-[12ch] text-[clamp(3.1rem,7vw,6.9rem)] leading-[.98] text-foreground">{t("tagline")}</h1>
            <p className="mt-5 max-w-[46ch] text-base leading-relaxed text-muted sm:text-lg">{t("intro")}</p>
            <Link href="/recherche" className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-verified underline decoration-verified/30 underline-offset-4 hover:decoration-verified">{t("allStays")}<span aria-hidden="true">→</span></Link>
          </div>
          <div className="w-full max-w-[39rem] justify-self-end rounded-[var(--radius-large)] border border-border/90 bg-surface p-5 shadow-[var(--shadow-card)] sm:p-7 lg:p-8">
            <div className="flex items-start gap-4"><span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full bg-verified text-verified-foreground"><svg viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.1 4.1L19.5 6"/><circle cx="12" cy="12" r="9.2"/></svg></span><div><p className="eyebrow">{t("verificationTitle")}</p><p className="mt-2 max-w-[39ch] text-sm leading-relaxed text-muted">{t("verificationBody")}</p></div></div>
            <form action={`/${locale}/recherche`} className="mt-6 flex flex-col gap-3 border-t border-border pt-5">
              <Field id="home-quartier" className="min-h-12 bg-white" name="quartier" label={t("searchLocation")} placeholder={t("searchPlaceholder")} autoComplete="address-level2" />
              <Button className="!min-h-12 justify-between !px-5" type="submit">{t("searchCta")}<span aria-hidden="true">→</span></Button>
              <p className="text-xs text-muted">{search("verifiedFilterHint")}</p>
            </form>
          </div>
        </div>
      </section>

      <section className="page-shell py-12 sm:py-16 lg:py-20" aria-labelledby="discover-heading">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">{t("staysDescription")}</p><h2 id="discover-heading" className="mt-2 max-w-[17ch] text-[clamp(2rem,3.5vw,3.45rem)] leading-tight">{t("stays")}</h2></div><Link href="/recherche" className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-verified underline decoration-verified/30 underline-offset-4 hover:decoration-verified sm:self-auto">{t("allStays")}<span aria-hidden="true">→</span></Link></div>
        {featured.length ? <div className="property-grid property-grid-wide mt-8 lg:mt-10">{featured.map((property,index) => <PropertyCard key={property.id} property={property} photo={photoByProperty.get(property.id) ?? null} priority={index===0} />)}</div> : <div className="mt-8 surface-card-plain p-7 sm:p-10"><h3 className="font-display text-2xl">{t("emptyTitle")}</h3><p className="mt-2 max-w-[55ch] text-sm leading-relaxed text-muted">{t("emptyBody")}</p><Link className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-verified underline underline-offset-4" href="/recherche">{t("allStays")}</Link></div>}
        <p className="mt-5 max-w-[72ch] text-xs leading-relaxed text-muted">{t("cities")}</p>
      </section>

      <section className="border-y border-border bg-white py-10 sm:py-12"><div className="page-shell grid gap-7 md:grid-cols-[minmax(0,1fr)_minmax(22rem,.8fr)] md:items-center"><div><p className="eyebrow">{common("appName")}</p><h2 className="mt-2 max-w-[19ch] text-[clamp(1.9rem,3.4vw,3.1rem)] leading-tight">{t("verificationTitle")}</h2><p className="mt-3 max-w-[58ch] text-sm leading-relaxed text-muted">{t("verificationBody")}</p></div>{firstVerified ? <VerificationNote verification={firstVerified} /> : <div className="surface-card-plain p-5 text-sm leading-relaxed text-muted sm:p-6">{t("verificationBody")}</div>}</div></section>
    </div><SiteFooter /></div>;
}
