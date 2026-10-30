import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/client";
import { isVerificationValid } from "@/lib/verification/badge";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PropertyCard } from "@/components/property/PropertyCard";
import { PropertyImage } from "@/components/property/PropertyImage";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { nbsp } from "@/lib/format/nbsp";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

// Les logements affichés viennent de la base : rendu à chaque visite, jamais figé à la construction de l'image.
export const dynamic = "force-dynamic";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const common = await getTranslations("common");
  const search = await getTranslations("search");
  const verif = await getTranslations("verification");
  const format = await getFormatter();
  const where = { status: "PUBLISHED" as const, verification: { is: { status: "ACTIVE" as const, expiresAt: { gt: new Date() } } } };
  const homes = await prisma.property.findMany({ where, orderBy: { createdAt: "desc" }, take: 4, select: { id: true, isDemo: true, title: true, neighborhood: true, city: true, pricePerNight: true, maxGuests: true, verification: { select: { status: true, visitDate: true, expiresAt: true } } } });
  const featuredPhotos = homes.length ? await prisma.visitPhoto.findMany({ where: { slot: "FACADE", visit: { verification: { propertyId: { in: homes.map(home => home.id) } } } }, select: { storageKey: true, isDemoPlaceholder: true, visit: { select: { verification: { select: { propertyId: true } } } } } }) : [];
  const photoByProperty = new Map(featuredPhotos.map(photo => [photo.visit.verification?.propertyId, photo]));
  const featured = homes.filter(home => home.verification && isVerificationValid(home.verification));

  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
  ];
  const checks = [t("verifyPoint1"), t("verifyPoint2"), t("verifyPoint3"), t("verifyPoint4")];
  const hero = featured
    .map(home => ({ home, photo: photoByProperty.get(home.id) }))
    .find(({ photo }) => photo && !photo.isDemoPlaceholder && !photo.storageKey.startsWith("demo-placeholder/"));

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">
        <section aria-labelledby="hero-title">
          <div className="page-shell grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,.92fr)] lg:gap-20 lg:py-16">
            <div>
              <p className="eyebrow">{t("eyebrow")}</p>
              <h1 id="hero-title" className="t-hero mt-4 max-w-[13ch]">{t("heroTitle")}</h1>
              <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-muted">{t("intro")}</p>
              <form action={`/${locale}/recherche`} className="mt-9 grid max-w-[37rem] grid-cols-2 gap-3 sm:grid-cols-6">
                <div className="col-span-2 sm:col-span-6"><Field id="home-quartier" name="quartier" label={t("searchLocation")} placeholder={t("searchPlaceholder")} autoComplete="address-level2" className="min-h-12" /></div>
                <div className="col-span-1 sm:col-span-2"><Field id="home-arrivee" name="arrivee" type="date" label={search("checkInLabel")} className="min-h-12" /></div>
                <div className="col-span-1 sm:col-span-2"><Field id="home-depart" name="depart" type="date" label={search("checkOutLabel")} className="min-h-12" /></div>
                <div className="col-span-2 sm:col-span-2"><Field id="home-voyageurs" name="voyageurs" type="number" min={1} label={search("guestsLabel")} className="min-h-12" /></div>
                <Button className="col-span-2 !min-h-12 sm:col-span-6" type="submit">{t("searchCta")}</Button>
              </form>
            </div>

            {hero ? (
              <Link href={`/logements/${hero.home.id}`} className="group relative block aspect-[4/5] overflow-hidden porte bg-surface-alt sm:aspect-[16/11] lg:aspect-auto lg:h-[36rem]">
                <PropertyImage storageKey={hero.photo!.storageKey} isDemoPlaceholder={false} alt={hero.home.title} width={900} height={1000} priority sizes="(min-width: 1024px) 45vw, 100vw" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
                <div className="absolute inset-x-4 bottom-4 rounded-[var(--radius)] bg-background p-4 shadow-[var(--shadow-pop)] sm:inset-x-5 sm:bottom-5 sm:p-5">
                  <p className="text-xs font-semibold text-accent">{t("featuredLabel")}</p>
                  <p className="t-3 mt-1">{hero.home.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{hero.home.neighborhood} · {hero.home.city}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3">
                    {hero.home.verification ? <VerifiedBadge verification={hero.home.verification} compact /> : null}
                    <span className="text-sm text-muted">{hero.home.verification ? verif("badgeVisited", { date: format.dateTime(hero.home.verification.visitDate, { day: "numeric", month: "short", year: "numeric" }) }) : null}</span>
                  </div>
                  <p className="mt-2 text-sm"><span className="font-semibold tabular-nums">{nbsp(format.number(hero.home.pricePerNight))} {search("perNight")}</span></p>
                </div>
              </Link>
            ) : (
              <aside aria-label={t("exampleLabel")} className="porte motif-porte px-5 pb-6 pt-14 sm:px-8 sm:pb-8 sm:pt-20 lg:h-[36rem] lg:pt-24">
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
            )}
          </div>
        </section>

        <section className="page-shell py-12 sm:py-16 lg:py-20" aria-labelledby="discover-heading">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 id="discover-heading" className="t-1">{t("stays")}</h2>
              <p className="mt-2 max-w-[52ch] text-muted">{t("staysDescription")}</p>
            </div>
            <Link href="/recherche" className="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent sm:self-auto">{t("allStays")}<span aria-hidden="true">→</span></Link>
          </div>
          {featured.length ? (
            <div className="property-grid property-grid-wide mt-9">{featured.map((property, index) => <PropertyCard key={property.id} property={property} photo={photoByProperty.get(property.id) ?? null} priority={index === 0 && !hero} />)}</div>
          ) : (
            <div className="surface-card-plain mt-9 p-7 sm:p-10"><h3 className="t-3">{t("emptyTitle")}</h3><p className="mt-2 max-w-[55ch] text-muted">{t("emptyBody")}</p></div>
          )}
        </section>

        <section className="bg-surface py-14 sm:py-20 lg:py-24" aria-labelledby="steps-heading">
          <div className="page-shell grid gap-10 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] lg:gap-24">
            <h2 id="steps-heading" className="t-display max-w-[11ch]">{t("stepsTitle")}</h2>
            <ol className="divide-y divide-foreground/15 border-y border-foreground/15">
              {steps.map((step, index) => (
                <li key={step.title} className="grid gap-2 py-7 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-6">
                  <span aria-hidden="true" className="text-sm font-semibold tabular-nums text-accent">{String(index + 1).padStart(2, "0")}</span>
                  <div><h3 className="t-3">{step.title}</h3><p className="mt-2 max-w-[56ch] leading-relaxed text-muted">{step.body}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-indigo py-14 text-white sm:py-20 lg:py-24" aria-labelledby="verify-heading">
          <div className="page-shell grid gap-10 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:gap-24">
            <div>
              <h2 id="verify-heading" className="t-display max-w-[16ch]">{t("verifyTitle")}</h2>
              <p className="mt-5 max-w-[48ch] text-lg leading-relaxed text-white/80">{t("verifyIntro")}</p>
            </div>
            <div>
              <ul className="grid gap-x-12 gap-y-9 sm:grid-cols-2">
                {checks.map(item => (
                  <li key={item} className="flex items-start gap-3.5">
                    <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 size-7 shrink-0" aria-hidden="true"><path d="M5 22V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5V22" stroke="#fff" strokeOpacity=".9" strokeWidth="1.8" /><path d="m8.5 14.2 2.6 2.7 4.6-5.6" stroke="var(--ocre)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className="text-[1.0625rem] leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-9 border-t border-white/25 pt-5 text-sm text-white/75">{t("verifyValidity")}</p>
            </div>
          </div>
        </section>

        <section className="bg-anthracite py-12 text-chaux sm:py-14">
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
