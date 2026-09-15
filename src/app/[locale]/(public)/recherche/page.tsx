import { dateOnlySchema, validStayRange, selectionQuery } from "@/lib/booking/selection";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/client";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PropertyImage } from "@/components/PropertyImage";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Recherche par quartier, dates et budget (CDC §6.1.1) — formulaire GET
 * classique, sans JavaScript requis pour fonctionner (réseau dégradé,
 * CDC §2). Ne liste que des biens publiés dont la vérification est
 * active à l'instant présent, pas seulement au moment de la publication
 * (même principe que src/lib/verification/badge.ts).
 */
export default async function SearchPage({
  params,
  searchParams,
}: PageProps<"/[locale]/recherche">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("search");
  const tVerif = await getTranslations("verification");
  const format = await getFormatter();

  const neighborhood = typeof sp.quartier === "string" ? sp.quartier.trim() : "";
  const checkIn = typeof sp.arrivee === "string" ? sp.arrivee : "";
  const checkOut = typeof sp.depart === "string" ? sp.depart : "";
  const guests = typeof sp.voyageurs === "string" && sp.voyageurs !== "" ? Number(sp.voyageurs) : undefined;
  const maxPrice = typeof sp.budget === "string" && sp.budget !== "" ? Number(sp.budget) : undefined;

  const invalidDates = (Boolean(checkIn) || Boolean(checkOut)) && (
    !dateOnlySchema.safeParse(checkIn).success || !dateOnlySchema.safeParse(checkOut).success ||
    !validStayRange(new Date(checkIn), new Date(checkOut))
  );
  const invalidFilters = invalidDates ||
    (guests !== undefined && (!Number.isSafeInteger(guests) || guests < 1)) ||
    (maxPrice !== undefined && (!Number.isSafeInteger(maxPrice) || maxPrice < 0));
  const query = selectionQuery(sp);
  const where: Prisma.PropertyWhereInput = {
    status: "PUBLISHED",
    verification: { is: { status: "ACTIVE", expiresAt: { gt: new Date() } } },
    ...(neighborhood ? { neighborhood: { contains: neighborhood, mode: "insensitive" } } : {}),
    ...(guests && Number.isFinite(guests) ? { maxGuests: { gte: guests } } : {}),
    ...(maxPrice !== undefined && Number.isFinite(maxPrice) ? { pricePerNight: { lte: maxPrice } } : {}),
  };

  const checkInDate = checkIn ? new Date(checkIn) : null;
  const checkOutDate = checkOut ? new Date(checkOut) : null;
  if (checkInDate && checkOutDate && checkOutDate > checkInDate) {
    // Absence de ligne = disponible (CDC §7.3) : on n'exclut que les biens
    // portant un jour explicitement non-OPEN dans l'intervalle demandé.
    where.availability = {
      none: { date: { gte: checkInDate, lt: checkOutDate }, status: { not: "OPEN" } },
    };
  }

  const properties = invalidFilters ? [] : await prisma.property.findMany({
    where,
    select: {
      id: true,
      title: true,
      neighborhood: true,
      city: true,
      pricePerNight: true,
      maxGuests: true,
      verification: { select: { visitDate: true, expiresAt: true, status: true } },
      // Jamais les coordonnées du propriétaire ici (CDC §6.1.5) : ce select
      // ne les inclut délibérément pas.
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const propertyIds = properties.map((p) => p.id);
  const coverPhotos = await prisma.visitPhoto.findMany({
    where: { slot: "FACADE", visit: { verification: { propertyId: { in: propertyIds } } } },
    select: { storageKey: true, visit: { select: { verification: { select: { propertyId: true } } } } },
  });
  const coverByPropertyId = new Map(
    coverPhotos.map((photo) => [photo.visit.verification?.propertyId, photo.storageKey])
  );

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <form className="flex flex-wrap gap-3" action={`/${locale}/recherche`}>
        <Field id="quartier" name="quartier" label={t("neighborhoodLabel")} placeholder={t("neighborhoodPlaceholder")} defaultValue={neighborhood} />
        <Field id="arrivee" name="arrivee" type="date" label={t("checkInLabel")} defaultValue={checkIn} />
        <Field id="depart" name="depart" type="date" label={t("checkOutLabel")} defaultValue={checkOut} />
        <Field id="voyageurs" name="voyageurs" type="number" min={1} label={t("guestsLabel")} defaultValue={Number.isFinite(guests) ? guests?.toString() : ""} />
        <Field id="budget" name="budget" type="number" min={0} label={t("maxPriceLabel")} defaultValue={Number.isFinite(maxPrice) ? maxPrice?.toString() : ""} />
        <Button type="submit" className="self-end">
          {t("submit")}
        </Button>
      </form>

      {invalidFilters ? <p role="alert" className="text-sm text-danger">{t("invalidFilters")}</p> : <p className="text-sm text-muted">{t("resultsCount", { count: properties.length })}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {properties.length === 0 ? (
          <p className="text-sm text-muted">{invalidFilters ? "" : t("noResults")}</p>
        ) : (
          properties.map((property, index) => {
            const storageKey = coverByPropertyId.get(property.id);
            return (
              <Link key={property.id} href={`/logements/${property.id}${query}`}>
                <Card className="flex gap-3">
                  {storageKey ? (
                    // Une vraie vignette, taille fixe — pas une photo pleine
                    // largeur : sur mobile, "100vw" aurait fait demander un
                    // fichier bien plus lourd que les 30 Ko du budget de
                    // liste (CDC §7.3), la fiche détaillée reste l'endroit
                    // pour l'expérience visuelle complète.
                    <PropertyImage
                      storageKey={storageKey}
                      alt={property.title}
                      width={96}
                      height={96}
                      priority={index === 0}
                      className="h-24 w-24 shrink-0 rounded-[var(--radius-default)] object-cover"
                    />
                  ) : null}
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{property.title}</span>
                    </div>
                    {property.verification ? <VerifiedBadge verification={property.verification} /> : null}
                    <span className="text-sm text-muted">
                      {property.neighborhood}, {property.city} · {property.pricePerNight} {t("perNight")}
                    </span>
                    {property.verification ? (
                      <span className="text-xs text-muted">
                        {tVerif("visitedOn", { date: format.dateTime(property.verification.visitDate, { dateStyle: "medium" }) })}
                      </span>
                    ) : null}
                  </div>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
