import { dateOnlySchema, selectionQuery } from "@/lib/booking/selection";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/client";
import { isVerificationValid } from "@/lib/verification/badge";
import { isoDate, startOfUtcDay, addUtcDays } from "@/lib/booking/nights";
import { BookingWizard } from "./BookingWizard";

const AVAILABILITY_WINDOW_DAYS = 120;

/**
 * Tunnel de réservation (CDC §6.2, épic 5) : sélection de dates avec
 * disponibilité temps réel (5.1) et identification du voyageur par OTP
 * sans compte (5.3), portées par BookingWizard. Le verrouillage du
 * calendrier et son expiration (5.2) sont posés côté actions.ts ;
 * l'acceptation par le propriétaire (5.4) se joue ensuite dans son espace
 * de gestion (voir (owner)/proprietaire/biens/[propertyId]).
 */
export default async function BookingPage({ params, searchParams }: PageProps<"/[locale]/reserver/[propertyId]">) {
  const { locale, propertyId } = await params;
  const sp = await searchParams;
  const query = selectionQuery(sp);
  setRequestLocale(locale);
  const t = await getTranslations("booking");

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      title: true,
      maxGuests: true,
      status: true,
      verification: { select: { status: true, expiresAt: true } },
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

  const today = startOfUtcDay();
  const windowEnd = addUtcDays(today, AVAILABILITY_WINDOW_DAYS);

  const unavailable = await prisma.availabilityDay.findMany({
    where: { propertyId, date: { gte: today, lt: windowEnd }, status: { not: "OPEN" } },
    select: { date: true },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8">
      <Link href={`/logements/${property.id}${query}`} className="text-xs text-muted">
        ← {t("backToProperty")}
      </Link>
      <h1 className="text-xl font-semibold">{t("bookHeading", { title: property.title })}</h1>
      <BookingWizard
        initialCheckIn={dateOnlySchema.safeParse(sp.arrivee).data ?? ""}
        initialCheckOut={dateOnlySchema.safeParse(sp.depart).data ?? ""}
        initialGuests={typeof sp.voyageurs === "string" && /^[1-9][0-9]*$/.test(sp.voyageurs) ? sp.voyageurs : "1"}
        propertyId={property.id}
        locale={locale}
        maxGuests={property.maxGuests}
        minDate={isoDate(today)}
        unavailableDates={unavailable.map((a) => isoDate(a.date))}
      />
    </div>
  );
}
