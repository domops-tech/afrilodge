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
  const common = await getTranslations("common");
  const where = { status: "PUBLISHED" as const, verification: { is: { status: "ACTIVE" as const, expiresAt: { gt: new Date() } } } };
  const homes = await prisma.property.findMany({ where, orderBy: { createdAt: "desc" }, take: 4, select: { id: true, isDemo: true, title: true, neighborhood: true, city: true, pricePerNight: true, maxGuests: true, verification: { select: { status: true, visitDate: true, expiresAt: true } } } });
  const featuredPhotos = homes.length ? await prisma.visitPhoto.findMany({ where: { slot: "FACADE", visit: { verification: { propertyId: { in: homes.map(home => home.id) } } } }, select: { storageKey: true, isDemoPlaceholder: true, visit: { select: { verification: { select: { propertyId: true } } } } } }) : [];
  const photoByProperty = new Map(featuredPhotos.map(photo => [photo.visit.verification?.propertyId, photo]));
  const featured = homes.filter(home => home.verification && isVerificationValid(home.verification));
  const firstVerified = featured.find(home => home.verification)?.verification ?? null;

  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
  ];
  const checks = [t("verifyPoint1"), t("verifyPoint2"), t("verifyPoint3"), t("verifyPoint4")];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">
        <section className="border-b border-border">
          <div className="page-shell grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,.9fr)] lg:gap-16 lg:py-20">
            <div>
              <p className="eyebrow">{t("eyebrow")}</p>
              <h1 className="t-display mt-3 max-w-[16ch]">{t("heroTitle")}</h1>
              <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-muted">{t("intro")}</p>
              <form action={`/${locale}/recherche`} className="mt-8 flex max-w-[34rem] flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Field id="home-quartier" name="quartier" label={t("searchLocation")} placeholder={t("searchPlaceholder")} autoComplete="address-level2" className="min-h-12" />
                </div>
                <Button className="!min-h-12" type="submit">{t("searchCta")}</Button>
              </form>
            </div>
            <aside aria-label={t("exampleLabel")} className="porte bg-terracotta px-5 pb-6 pt-10 sm:px-8 sm:pb-8 sm:pt-14">
              <div className="rounded-[var(--radius)] bg-background p-5 text-foreground shadow-[var(--shadow-pop)] sm:p-6">
                <p className="text-sm font-medium text-muted">{t("exampleLabel")}</p>
                <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-verified py-1 pl-2 pr-3.5 text-[.8125rem] font-semibold leading-none text-verified-foreground">
                  <svg viewBox="0 0 24 24" fill="none" className="size-5 shrink-0" aria-hidden="true"><path d="M5 22V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5V22" stroke="currentColor" strokeWidth="2" /><path d="m8.5 14.2 2.6 2.7 4.6-5.6" stroke="var(--ocre)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {common("verifiedOnSite")}
                </span>
                <p className="mt-4 text-[1.0625rem] font-medium leading-snug">{t("exampleVisit")}</p>
                <p className="mt-2 border-t border-border pt-3 text-sm leading-relaxed text-muted">{t("exampleAmenity")}</p>
              </div>
            </aside>
          </div>
        </section>

        <section className="page-shell py-12 sm:py-16" aria-labelledby="discover-heading">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 id="discover-heading" className="t-1">{t("stays")}</h2>
              <p className="mt-2 max-w-[52ch] text-muted">{t("staysDescription")}</p>
            </div>
            <Link href="/recherche" className="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent sm:self-auto">{t("allStays")}<span aria-hidden="true">→</span></Link>
          </div>
          {featured.length ? (
            <div className="property-grid property-grid-wide mt-8">{featured.map((property, index) => <PropertyCard key={property.id} property={property} photo={photoByProperty.get(property.id) ?? null} priority={index === 0} />)}</div>
          ) : (
            <div className="surface-card-plain mt-8 p-7 sm:p-10"><h3 className="t-3">{t("emptyTitle")}</h3><p className="mt-2 max-w-[55ch] text-muted">{t("emptyBody")}</p></div>
          )}
        </section>

        <section className="bg-surface py-12 sm:py-16" aria-labelledby="steps-heading">
          <div className="page-shell">
            <h2 id="steps-heading" className="t-1">{t("stepsTitle")}</h2>
            <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-lg font-bold text-accent-foreground">{index + 1}</span>
                  <div><h3 className="t-3">{step.title}</h3><p className="mt-1.5 leading-relaxed text-muted">{step.body}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="page-shell grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:gap-16" aria-labelledby="verify-heading">
          <div>
            <h2 id="verify-heading" className="t-1">{t("verifyTitle")}</h2>
            <p className="mt-3 max-w-[56ch] text-lg leading-relaxed text-muted">{t("verifyIntro")}</p>
            <ul className="mt-6 space-y-3">
              {checks.map(item => (
                <li key={item} className="flex items-start gap-3">
                  <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 size-6 shrink-0 text-verified" aria-hidden="true"><path d="M5 22V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5V22" stroke="currentColor" strokeWidth="1.8" /><path d="m8.5 14.2 2.6 2.7 4.6-5.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted">{t("verifyValidity")}</p>
          </div>
          {firstVerified ? <div className="self-start"><VerificationNote verification={firstVerified} /></div> : null}
        </section>

        <section className="border-t border-border bg-anthracite py-12 text-chaux sm:py-14">
          <div className="page-shell flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="t-2">{t("ownerTitle")}</h2>
              <p className="mt-2 max-w-[52ch] text-chaux/80">{t("ownerBody")}</p>
            </div>
            <Link href="/connexion" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-[var(--radius)] bg-terracotta px-6 font-semibold text-anthracite hover:brightness-110">{t("ownerCta")}</Link>
          </div>
        </section>
      </div>
      <SiteFooter />
    </div>
  );
}
