import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/client";
import { PropertyImage } from "@/components/PropertyImage";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ApproximateMap } from "@/components/ApproximateMap";
import { Button } from "@/components/ui/Button";
import { isVerificationValid } from "@/lib/verification/badge";

/**
 * Fiche détaillée d'un logement (CDC §6.1.3). Coordonnées exactes et
 * contact du propriétaire jamais sélectionnés ici (CDC §6.1.5) : ce n'est
 * pas un filtrage a posteriori, la requête ne les récupère jamais.
 */
export default async function PropertyDetailPage({
  params,
}: PageProps<"/[locale]/logements/[propertyId]">) {
  const { locale, propertyId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("property");
  const tVerif = await getTranslations("verification");
  const format = await getFormatter();

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      title: true,
      description: true,
      pricePerNight: true,
      maxGuests: true,
      neighborhood: true,
      city: true,
      latitude: true,
      longitude: true,
      accessLandmarks: true,
      status: true,
      amenities: { select: { name: true, confirmed: true } },
      verification: {
        select: {
          status: true,
          visitDate: true,
          expiresAt: true,
          visit: {
            select: {
              agent: { select: { fullName: true } },
              photos: { select: { id: true, slot: true, label: true, storageKey: true } },
            },
          },
        },
      },
    },
  });

  if (
    !property ||
    property.status !== "PUBLISHED" ||
    !property.verification ||
    !isVerificationValid(property.verification)
  ) {
    notFound();
  }

  const { verification } = property;
  const photos = [...verification.visit.photos].sort((a, b) =>
    a.slot === "FACADE" ? -1 : b.slot === "FACADE" ? 1 : 0
  );
  const confirmedAmenities = property.amenities.filter((a) => a.confirmed);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/recherche" className="text-xs text-muted">
        ← {t("backToSearch")}
      </Link>

      {photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo, i) => (
            <PropertyImage
              key={photo.id}
              storageKey={photo.storageKey}
              alt={photo.label ?? photo.slot}
              width={i === 0 ? 640 : 240}
              height={i === 0 ? 400 : 160}
              priority={i === 0}
              sizes={i === 0 ? "(max-width: 640px) 100vw, 640px" : "(max-width: 640px) 33vw, 240px"}
              className={`h-auto w-full rounded-[var(--radius-default)] object-cover ${i === 0 ? "col-span-2 row-span-2 sm:col-span-1" : ""}`}
            />
          ))}
        </div>
      ) : null}

      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">{property.title}</h1>
          <VerifiedBadge verification={verification} />
        </div>
        <span className="text-sm text-muted">
          {property.neighborhood}, {property.city} · {t("guestsMax", { count: property.maxGuests })}
        </span>
        <span className="text-sm text-muted">
          {tVerif("visitedOn", { date: format.dateTime(verification.visitDate, { dateStyle: "long" }) })}
          {" · "}
          {tVerif("verifiedBy", { agentName: verification.visit.agent.fullName })}
        </span>
        <span className="text-lg font-semibold">{t("pricePerNight", { price: property.pricePerNight })}</span>
      </header>

      <p className="text-sm">{property.description}</p>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t("sectionAmenities")}</h2>
        {confirmedAmenities.length === 0 ? (
          <p className="text-sm text-muted">{t("noAmenities")}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {confirmedAmenities.map((a) => (
              <li key={a.name} className="rounded-full bg-surface px-3 py-1 text-sm">
                {a.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t("sectionLandmarks")}</h2>
        <p className="text-sm text-muted">{property.accessLandmarks || t("noLandmarks")}</p>
      </section>

      {property.latitude !== null && property.longitude !== null ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">{t("sectionMap")}</h2>
          <ApproximateMap latitude={property.latitude} longitude={property.longitude} />
          <p className="text-xs text-muted">{t("mapDisclaimer")}</p>
        </section>
      ) : null}

      <Link href={`/reserver/${property.id}`}>
        <Button className="w-full">{t("bookCta")}</Button>
      </Link>
    </div>
  );
}
