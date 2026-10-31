import { nbsp } from "@/lib/format/nbsp";
import { selectionQuery } from "@/lib/booking/selection";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/client";
import { PropertyImage } from "@/components/property/PropertyImage";
import { PropertyGallery, type GalleryRoom } from "@/components/property/PropertyGallery";
import { BookingBar } from "@/components/property/BookingBar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ApproximateMap } from "@/components/ApproximateMap";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { VerificationNote } from "@/components/property/VerificationNote";
import { buttonClassName } from "@/components/ui/Button";
import { isVerificationValid } from "@/lib/verification/badge";
import { resolvePublicStorageUrl } from "@/lib/storage/public-url";

// Ordre de visite : on arrive par la façade, on entre, on traverse les pièces, puis cuisine, sanitaires, vue.
const SLOT_ORDER = ["FACADE", "ACCES", "ENTREE", "PIECE", "CUISINE", "SANITAIRES", "VUE"] as const;

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
      visit: { select: { agent: { select: { fullName: true } }, photos: { select: { id: true, slot: true, label: true, storageKey: true, isDemoPlaceholder: true }, orderBy: { takenAt: "asc" } } } },
    } },
  } });
  if (!property || property.status !== "PUBLISHED" || !property.verification || !isVerificationValid(property.verification)) notFound();
  const verification = property.verification;
  const realPhotos = verification.visit.photos.filter(photo => !photo.isDemoPlaceholder);
  const target = `/reserver/${property.id}${query}`;
  const price = `${nbsp(format.number(property.pricePerNight))} FCFA`;
  const confirmedAmenities = property.amenities.filter(item => item.confirmed).length;

  const rooms: GalleryRoom[] = [];
  for (const slot of SLOT_ORDER) {
    const ofSlot = realPhotos.filter(photo => photo.slot === slot);
    if (!ofSlot.length) continue;
    const toPhoto = (photo: (typeof ofSlot)[number], label: string) => ({ id: photo.id, src: resolvePublicStorageUrl(photo.storageKey), alt: `${label}, ${property.title}` });
    if (slot === "PIECE") {
      const byLabel = new Map<string, typeof ofSlot>();
      for (const photo of ofSlot) {
        const label = photo.label?.trim() || t("photoSlot.PIECE");
        byLabel.set(label, [...(byLabel.get(label) ?? []), photo]);
      }
      for (const [label, photos] of byLabel) rooms.push({ id: `piece-${rooms.length}`, label, photos: photos.map(photo => toPhoto(photo, label)) });
    } else {
      const label = t(`photoSlot.${slot}`);
      rooms.push({ id: slot.toLowerCase(), label, photos: ofSlot.map(photo => toPhoto(photo, label)) });
    }
  }
  const cover = SLOT_ORDER.map(slot => realPhotos.find(photo => photo.slot === slot)).find(Boolean);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader active="search" />
      <div className="flex-1">
        <section aria-label={property.title} className="relative flex min-h-[calc(100svh-var(--header-h))] flex-col justify-end overflow-hidden bg-surface-alt">
          {cover ? (
            <PropertyImage storageKey={cover.storageKey} isDemoPlaceholder={false} alt={property.title} width={1920} height={1080} priority sizes="100vw" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="motif-porte absolute inset-0" aria-hidden="true" />
          )}
          <div className="page-shell relative z-10 pt-6">
            <Link href={`/recherche${query}`} className="caps inline-flex min-h-11 items-center gap-2 bg-background px-4 text-foreground transition-colors hover:bg-foreground hover:text-background"><span aria-hidden="true">←</span>{t("backToSearch")}</Link>
          </div>
          <div className="page-shell relative z-10 mt-auto flex justify-end pb-5 pt-24 sm:pb-10">
            <div className="w-full bg-background p-6 sm:w-[24rem] sm:p-8">
              <p className="font-serif text-[2rem] leading-none tabular-nums">{price}</p>
              <p className="mt-1.5 text-sm text-muted">{t("priceNote")}</p>
              <Link href={target} className={buttonClassName("primary", "mt-6 !min-h-12 w-full")}>{t("bookCta")}</Link>
              <p className="mt-4 text-xs leading-relaxed text-muted">{t("requestNote")}</p>
              {rooms.length ? <a href="#visite" className="quiet-link mt-5 inline-block text-sm font-medium text-foreground underline underline-offset-4">{t("viewPhotos")}</a> : null}
            </div>
          </div>
        </section>
        <div id="hero-end" aria-hidden="true" />

        <section className="page-shell py-14 sm:py-20" aria-labelledby="property-title">
          {property.isDemo ? <div role="note" className="mb-10 border border-ocre/60 bg-ocre/10 px-4 py-3 text-sm leading-relaxed text-foreground"><span className="font-semibold">{tc("demoListing")}.</span> {tc("demoListingDetail")}</div> : null}
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-24">
            <div>
              <p className="eyebrow">{property.neighborhood}, {property.city}</p>
              <h1 id="property-title" className="t-hero mt-6">{property.title}</h1>
              <div className="mt-6"><VerifiedBadge verification={verification} compact /></div>
              <p className="lede mt-6 max-w-[50ch] text-muted">{property.description}</p>
            </div>
            <dl className="divide-y divide-border self-start border-y border-border">
              <div className="flex items-baseline justify-between gap-6 py-4"><dt className="text-sm text-muted">{t("capacityLabel")}</dt><dd className="text-right font-serif text-lg">{t("guestsMax", { count: property.maxGuests })}</dd></div>
              <div className="flex items-baseline justify-between gap-6 py-4"><dt className="text-sm text-muted">{t("visitDateLabel")}</dt><dd className="text-right font-serif text-lg">{format.dateTime(verification.visitDate, { dateStyle: "long" })}</dd></div>
              <div className="flex items-baseline justify-between gap-6 py-4"><dt className="text-sm text-muted">{t("validUntilLabel")}</dt><dd className="text-right font-serif text-lg">{format.dateTime(verification.expiresAt, { dateStyle: "long" })}</dd></div>
              {property.amenities.length ? <div className="flex items-baseline justify-between gap-6 py-4"><dt className="text-sm text-muted">{t("amenitiesLabel")}</dt><dd className="text-right font-serif text-lg">{t("amenitiesCount", { confirmed: confirmedAmenities, total: property.amenities.length })}</dd></div> : null}
            </dl>
          </div>
        </section>

        {rooms.length ? <PropertyGallery rooms={rooms} /> : (
          <section className="page-shell border-t border-border py-14 sm:py-20" aria-labelledby="no-photos"><h2 id="no-photos" className="t-2">{t("noPhotos")}</h2><p className="lede mt-3 max-w-[55ch] text-muted">{t("noPhotosDetail")}</p></section>
        )}

        <section className="border-t border-border" aria-label={t("verifiedHeading")}>
          <div className="page-shell grid gap-14 py-16 sm:py-24 lg:grid-cols-2 lg:gap-24">
            <div className="flex flex-col gap-12">
              <div className="flex flex-col gap-4" aria-labelledby="about-heading">
                <h2 id="about-heading" className="t-2">{t("verifiedHeading")}</h2>
                <p className="text-sm text-muted">{verification.visit.agent?.fullName ? `${tf("verifiedBy", { agentName: verification.visit.agent.fullName })} · ` : ""}{tf("teamVisitDate", { date: format.dateTime(verification.visitDate, { dateStyle: "medium" }) })}</p>
                <VerificationNote verification={verification} compact />
              </div>
              <section aria-labelledby="amenities-heading">
                <h2 id="amenities-heading" className="t-2">{t("sectionAmenities")}</h2>
                <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-muted">{t("verifiedDescription")}</p>
                {property.amenities.length ? (
                  <ul className="mt-6 grid gap-x-8 sm:grid-cols-2">{property.amenities.map(item => (
                    <li key={item.name} className="flex min-h-12 items-center justify-between gap-3 border-t border-border py-2.5 text-sm"><span>{item.name}</span><span className={`shrink-0 text-xs font-medium ${item.confirmed ? "text-verified" : "text-muted"}`}>{item.confirmed ? <><span aria-hidden="true">✓ </span>{t("amenityObserved")}</> : t("amenityDeclared")}</span></li>
                  ))}</ul>
                ) : <p className="mt-4 text-sm text-muted">{t("noAmenities")}</p>}
              </section>
            </div>
            <section aria-labelledby="area-heading">
              <h2 id="area-heading" className="t-2">{t("sectionLandmarks")}</h2>
              <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-muted">{t("landmarksNote")}</p>
              <p className="mt-3 max-w-[56ch] leading-relaxed">{property.accessLandmarks || t("noLandmarks")}</p>
              {property.latitude !== null && property.longitude !== null ? <div className="mt-6"><ApproximateMap latitude={property.latitude} longitude={property.longitude} /><p className="mt-2 text-xs leading-relaxed text-muted">{t("mapDisclaimer")}</p></div> : null}
            </section>
          </div>
        </section>
      </div>
      <BookingBar title={property.title} price={`${price} / ${t("perNight")}`} label={t("bookCta")} href={target} />
      <SiteFooter />
    </div>
  );
}
