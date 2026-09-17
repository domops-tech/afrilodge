import { selectionQuery } from "@/lib/booking/selection";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/client";
import { PropertyImage } from "@/components/property/PropertyImage";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ApproximateMap } from "@/components/ApproximateMap";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { VerificationNote } from "@/components/property/VerificationNote";
import { buttonClassName } from "@/components/ui/Button";
import { isVerificationValid } from "@/lib/verification/badge";

export default async function PropertyDetailPage({ params, searchParams }: PageProps<"/[locale]/logements/[propertyId]">) {
  const { locale, propertyId } = await params;
  const queryParams = await searchParams;
  const query = selectionQuery(queryParams);
  setRequestLocale(locale);
  const t = await getTranslations("property");
  const tf = await getTranslations("verification");
  const tc = await getTranslations("common");
  const format = await getFormatter();
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: {
    id: true, isDemo: true, title: true, description: true, pricePerNight: true, maxGuests: true,
    neighborhood: true, city: true, latitude: true, longitude: true, accessLandmarks: true, status: true,
    amenities: { select: { name: true, confirmed: true } },
    verification: { select: {
      status: true, visitDate: true, expiresAt: true,
      visit: { select: { agent: { select: { fullName: true } }, photos: { select: { id: true, slot: true, label: true, storageKey: true, isDemoPlaceholder: true } } } },
    } },
  } });
  if (!property || property.status !== "PUBLISHED" || !property.verification || !isVerificationValid(property.verification)) notFound();
  const verification = property.verification;
  const photos = verification.visit.photos;
  const realPhotos = photos.filter(photo => !photo.isDemoPlaceholder);
  const placeholder = photos.find(photo => photo.isDemoPlaceholder) ?? null;
  const orderedPhotos = [...realPhotos].sort((a,b) => (a.slot === "FACADE" ? -1 : b.slot === "FACADE" ? 1 : 0));
  const target = `/reserver/${property.id}${query}`;
  const pageTitle = property.title;

  return <div className="flex min-h-screen flex-col"><SiteHeader active="search"/><div className="flex-1 pb-24 lg:pb-0">
    <div className="page-shell pt-5 sm:pt-7"><Link href={`/recherche${query}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-verified"><span aria-hidden="true">←</span>{t("backToSearch")}</Link>
      {property.isDemo ? <div role="note" className="mb-4 rounded-[.85rem] border border-[#ddcaa3] bg-[#fbf5e9] px-4 py-3 text-sm leading-relaxed text-[#594a2f]"><span className="font-semibold">{tc("demoListing")}.</span> {tc("demoListingDetail")}</div> : null}
      <div className="mt-1 flex flex-col justify-between gap-5 pb-5 sm:mt-3 sm:flex-row sm:items-end"><div><p className="eyebrow">{property.neighborhood} <span aria-hidden="true">·</span> {property.city}</p><h1 className="mt-2 max-w-[22ch] text-[clamp(2.2rem,4vw,4.15rem)] leading-[1.02]">{pageTitle}</h1><p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted"><span>{t("guestsMax", { count: property.maxGuests })}</span><span aria-hidden="true">·</span><span>{tf("teamVisitDate", { date: format.dateTime(verification.visitDate, { dateStyle: "long" }) })}</span></p></div><div className="hidden shrink-0 flex-col items-end gap-3 self-start sm:flex sm:self-auto"><VerifiedBadge verification={verification}/><p className="text-sm font-semibold tabular-nums">{format.number(property.pricePerNight)} FCFA <span className="font-normal text-muted">/ {t("perNight")}</span></p><Link href={target} className={buttonClassName("primary","!min-h-11 !rounded-full !px-5")}>{t("bookCta")}<span aria-hidden="true">→</span></Link></div></div>
      {orderedPhotos.length ? <div className={`gallery-grid${orderedPhotos.length === 1 ? " gallery-grid-single" : ""}`} aria-label={t("photoCount", {count: orderedPhotos.length})}>{orderedPhotos.slice(0,5).map((photo,i)=><div key={photo.id} className="gallery-cell"><PropertyImage storageKey={photo.storageKey} alt={photo.label ?? t(`photoSlot.${photo.slot}`)} isDemoPlaceholder={false} width={i===0 ? 1300 : 620} height={i===0 ? 900 : 430} priority={i===0} sizes={i===0 ? "(max-width: 767px) 100vw, 50vw" : "(max-width: 767px) 50vw, 25vw"} className="h-full w-full object-cover"/></div>)}</div> : placeholder ? <div className="gallery-grid gallery-grid-single"><div className="gallery-cell"><PropertyImage storageKey={placeholder.storageKey} isDemoPlaceholder showPlaceholderDetail alt={tc("photoUnavailable")} width={1300} height={900} priority/></div></div> : <div role="img" aria-label={t("noPhotos")} className="gallery-grid gallery-grid-single surface-card-plain grid place-items-center"><div className="flex max-w-[32rem] flex-col items-center gap-3 px-5 py-9 text-center text-muted"><svg viewBox="0 0 24 24" fill="none" className="size-8" aria-hidden="true" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 3-4 5 6"/></svg><span className="font-medium">{t("noPhotos")}</span></div></div>}
    </div>

    <div className="page-shell grid gap-8 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,23rem)] lg:gap-12 lg:py-12 xl:gap-16">
      <div className="min-w-0 space-y-9 sm:space-y-11">
        <section className="flex flex-col gap-4" aria-labelledby="about-heading"><div className="flex items-center gap-3"><span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-verified-soft text-verified"><svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg></span><div><h2 id="about-heading" className="text-2xl sm:text-3xl">{t("verifiedHeading")}</h2><p className="mt-1 text-sm text-muted">{verification.visit.agent?.fullName ? `${tf("verifiedBy", { agentName: verification.visit.agent.fullName })} · ` : ""}{tf("teamVisitDate", { date: format.dateTime(verification.visitDate, { dateStyle: "medium" }) })}</p></div></div><VerificationNote verification={verification} compact/><p className="page-shell-reading text-[.96rem] leading-[1.85] text-foreground/85">{property.description}</p></section>

        <section aria-labelledby="amenities-heading" className="border-t border-border pt-7 sm:pt-8"><h2 id="amenities-heading" className="text-2xl sm:text-3xl">{t("sectionAmenities")}</h2><p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-muted">{t("verifiedDescription")}</p>
          {property.amenities.length ? <ul className="mt-5 grid gap-2 sm:grid-cols-2">{property.amenities.map(item=><li key={item.name} className="flex min-h-12 items-center justify-between gap-3 rounded-[.8rem] border border-border/80 bg-surface px-3.5 py-2.5 text-sm"><span>{item.name}</span><span className={`shrink-0 text-xs font-medium ${item.confirmed ? "text-verified" : "text-muted"}`}>{item.confirmed ? <><span aria-hidden="true">✓ </span>{t("amenityObserved")}</> : t("amenityDeclared")}</span></li>)}</ul> : <p className="mt-4 text-sm text-muted">{t("noAmenities")}</p>}
        </section>

        <section aria-labelledby="area-heading" className="border-t border-border pt-7 sm:pt-8"><h2 id="area-heading" className="text-2xl sm:text-3xl">{t("sectionLandmarks")}</h2><p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted">{t("landmarksNote")}</p><p className="mt-3 max-w-[65ch] text-sm leading-relaxed">{property.accessLandmarks || t("noLandmarks")}</p>{property.latitude !== null && property.longitude !== null ? <div className="mt-5"><ApproximateMap latitude={property.latitude} longitude={property.longitude}/><p className="mt-2 text-xs leading-relaxed text-muted">{t("mapDisclaimer")}</p></div> : null}</section>
      </div>

      <aside className="booking-summary hidden lg:block" aria-label={t("stayDetails")}><div className="surface-card p-5 xl:p-6"><p className="eyebrow">{t("priceLabel")}</p><p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{format.number(property.pricePerNight)} <span className="text-sm font-medium text-muted">FCFA <span aria-hidden="true">/</span> {t("perNight")}</span></p><p className="mt-1 text-xs leading-relaxed text-muted">{t("priceNote")}</p><div className="mt-5 border-t border-border pt-4"><VerificationNote verification={verification} compact/></div><p className="mt-4 text-sm leading-relaxed text-muted">{t("requestNote")}</p><Link href={target} className={buttonClassName("primary", "mt-5 w-full !min-h-12 !rounded-full")}>{t("bookCta")}<span aria-hidden="true">→</span></Link></div></aside>
    </div>
    <div className="mobile-cta-bar fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 pt-2 backdrop-blur sm:px-6 lg:hidden"><div className="mx-auto flex max-w-2xl items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-semibold tabular-nums">{format.number(property.pricePerNight)} FCFA<span className="font-normal text-muted"> / {t("perNight")}</span></p><p className="truncate text-xs text-muted">{property.neighborhood} · {tf("badge")}</p></div><Link href={target} className={buttonClassName("primary", "!min-h-11 shrink-0 !rounded-full !px-5")}>{t("bookCta")}</Link></div></div>
  </div><SiteFooter/></div>;
}
