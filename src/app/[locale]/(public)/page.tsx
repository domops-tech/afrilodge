import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/client";
import { isVerificationValid } from "@/lib/verification/badge";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PropertyCard } from "@/components/property/PropertyCard";
import { PropertyImage } from "@/components/property/PropertyImage";
import { nbsp } from "@/lib/format/nbsp";
import { buttonClassName } from "@/components/ui/Button";

// Les logements affichés viennent de la base : rendu à chaque visite, jamais figé à la construction de l'image.
export const dynamic = "force-dynamic";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
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
  const fieldLabel = "caps block !text-[.625rem] text-muted";
  const fieldInput = "mt-1 block w-full bg-transparent text-[0.9375rem] text-foreground outline-none placeholder:text-muted/70";
  const cell = "block border-b border-border px-6 py-4 focus-within:bg-surface md:px-8";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">
        <div className="flex flex-col lg:min-h-[calc(100svh-var(--header-h))]">
          <section aria-labelledby="hero-title" className="grid lg:flex-1 lg:grid-cols-[2fr_1fr]">
            {hero ? (
              <Link href={`/logements/${hero.home.id}`} className="group relative block h-[22rem] overflow-hidden bg-surface-alt sm:h-[30rem] lg:h-auto lg:min-h-[30rem]">
                <PropertyImage storageKey={hero.photo!.storageKey} isDemoPlaceholder={false} alt={hero.home.title} width={1600} height={1100} priority sizes="(min-width: 1024px) 66vw, 100vw" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.015]" />
                <div className="absolute bottom-0 left-0 max-w-[26rem] bg-background px-6 py-5">
                  <p className="caps !text-[.625rem] text-muted">{t("featuredLabel")}</p>
                  <p className="mt-1 font-serif text-xl leading-snug">{hero.home.title}</p>
                  <p className="mt-0.5 font-serif text-muted">{hero.home.neighborhood}, {hero.home.city}</p>
                  <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"><span className="font-medium tabular-nums">{nbsp(format.number(hero.home.pricePerNight))} {search("perNight")}</span>{hero.home.verification ? <span className="text-muted">{verif("badgeVisited", { date: format.dateTime(hero.home.verification.visitDate, { day: "numeric", month: "short", year: "numeric" }) })}</span> : null}</p>
                </div>
              </Link>
            ) : (
              <div className="motif-porte h-[18rem] sm:h-[26rem] lg:h-auto lg:min-h-[30rem]" aria-hidden="true" />
            )}
            <div className="flex flex-col justify-center bg-surface px-6 py-12 sm:px-12 lg:px-10 xl:px-14">
              <p className="eyebrow self-start">{t("eyebrow")}</p>
              <h1 id="hero-title" className="t-hero mt-6">{t("heroTitle")}</h1>
              <p className="lede mt-5 text-muted">{t("intro")}</p>
              <Link href="/recherche" className={buttonClassName("secondary", "mt-8 self-start")}>{t("allStays")}</Link>
            </div>
          </section>

          <div className="page-shell py-6 lg:py-8">
          <form action={`/${locale}/recherche`} aria-label={t("searchCta")} className="border border-foreground bg-background">
            <div className="grid md:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_.8fr_auto]">
              <label className={`${cell} md:col-span-2 lg:col-span-1 lg:border-b-0 lg:border-r lg:border-foreground/30`}><span className={fieldLabel}>{t("searchLocation")}</span><input name="quartier" placeholder={t("searchPlaceholder")} autoComplete="address-level2" className={fieldInput} /></label>
              <label className={`${cell} md:border-r md:border-foreground/30 lg:border-b-0`}><span className={fieldLabel}>{search("checkInLabel")}</span><input name="arrivee" type="date" className={fieldInput} /></label>
              <label className={`${cell} lg:border-b-0 lg:border-r lg:border-foreground/30`}><span className={fieldLabel}>{search("checkOutLabel")}</span><input name="depart" type="date" className={fieldInput} /></label>
              <label className={`${cell} md:border-b-0 md:border-r md:border-foreground/30 lg:border-r-0`}><span className={fieldLabel}>{search("guestsLabel")}</span><input name="voyageurs" type="number" min={1} className={fieldInput} /></label>
              <button type="submit" className="caps min-h-16 bg-foreground px-12 text-background transition-colors hover:bg-accent">{t("searchCta")}</button>
            </div>
          </form>
          </div>
        </div>

        <section className="page-shell py-16 sm:py-20" aria-labelledby="discover-heading">
          <div className="flex flex-col items-start justify-between gap-5 border-t border-border pt-8 sm:flex-row sm:items-center">
            <h2 id="discover-heading" className="caps text-foreground">{t("stays")}</h2>
            <Link href="/recherche" className={buttonClassName("secondary")}>{t("allStays")}</Link>
          </div>
          {featured.length ? (
            <div className="property-grid-explore mt-8">{featured.map((property, index) => <PropertyCard key={property.id} property={property} photo={photoByProperty.get(property.id) ?? null} priority={index === 0 && !hero} />)}</div>
          ) : (
            <div className="mt-8 border border-border p-8 sm:p-12"><h3 className="t-3">{t("emptyTitle")}</h3><p className="lede mt-2 max-w-[55ch] text-muted">{t("emptyBody")}</p></div>
          )}
        </section>

        <section className="border-t border-border" aria-labelledby="steps-heading">
          <div className="page-shell py-16 sm:py-24">
            <h2 id="steps-heading" className="caps text-center text-foreground">{t("stepsTitle")}</h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-12">
              {steps.map((step, index) => (
                <li key={step.title} className="border-t border-foreground pt-5">
                  <span aria-hidden="true" className="caps text-muted">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="t-2 mt-3">{step.title}</h3>
                  <p className="lede mt-3 !text-base text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-indigo py-16 text-white sm:py-24" aria-labelledby="verify-heading">
          <div className="page-shell grid gap-12 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:gap-24">
            <div>
              <h2 id="verify-heading" className="t-display max-w-[18ch]">{t("verifyTitle")}</h2>
              <p className="lede mt-6 max-w-[46ch] text-white/80">{t("verifyIntro")}</p>
            </div>
            <div>
              <ul className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
                {checks.map(item => (
                  <li key={item} className="flex items-start gap-4 border-t border-white/30 pt-4">
                    <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 size-6 shrink-0" aria-hidden="true"><path d="M5 22V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5V22" stroke="#fff" strokeOpacity=".9" strokeWidth="1.8" /><path d="m8.5 14.2 2.6 2.7 4.6-5.6" stroke="var(--ocre)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span className="font-serif text-[1.0625rem] leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="caps mt-10 !text-[.625rem] text-white/70">{t("verifyValidity")}</p>
            </div>
          </div>
        </section>

        <section className="bg-anthracite py-14 text-chaux">
          <div className="page-shell flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="t-2">{t("ownerTitle")}</h2>
              <p className="lede mt-2 max-w-[52ch] !text-base text-chaux/75">{t("ownerBody")}</p>
            </div>
            <Link href="/connexion" className="caps inline-flex min-h-12 shrink-0 items-center justify-center border border-chaux px-8 text-chaux transition-colors hover:bg-chaux hover:text-anthracite">{t("ownerCta")}</Link>
          </div>
        </section>
      </div>
      <SiteFooter />
    </div>
  );
}
