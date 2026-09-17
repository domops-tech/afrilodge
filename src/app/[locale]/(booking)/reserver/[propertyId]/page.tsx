import { dateOnlySchema, selectionQuery } from "@/lib/booking/selection";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/client";
import { isVerificationValid } from "@/lib/verification/badge";
import { isoDate, startOfUtcDay, addUtcDays } from "@/lib/booking/nights";
import { BookingWizard } from "./BookingWizard";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { VerifiedBadge } from "@/components/VerifiedBadge";

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
  const tc = await getTranslations("common");

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      isDemo: true,
      title: true,
      neighborhood: true,
      city: true,
      pricePerNight: true,
      maxGuests: true,
      status: true,
      verification: { select: { status: true, expiresAt: true, visitDate: true } },
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
    <div className="flex min-h-screen flex-col"><SiteHeader active="bookings"/><div className="page-shell flex-1 py-6 sm:py-10">
      <Link href={`/logements/${property.id}${query}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted hover:text-verified"><span aria-hidden="true">←</span>{t("backToProperty")}</Link>
      {property.isDemo ? <div role="note" className="mx-auto mt-4 max-w-[1240px] rounded-[.85rem] border border-[#ddcaa3] bg-[#fbf5e9] px-4 py-3 text-sm leading-relaxed text-[#594a2f]"><span className="font-semibold">{tc("demoListing")}.</span> {tc("demoListingDetail")}</div>:null}
      <div className="booking-layout mx-auto mt-4 max-w-[1240px]">
        <div><p className="eyebrow">{t("stayRequest")}</p><h1 className="mt-2 max-w-[20ch] text-[clamp(2rem,4.2vw,4rem)] leading-tight">{t("bookHeading", { title: property.title })}</h1><p className="mt-3 max-w-[55ch] text-sm leading-relaxed text-muted">{t("stayRequestSent")}</p>
      <BookingWizard
        initialCheckIn={dateOnlySchema.safeParse(sp.arrivee).data ?? ""}
        initialCheckOut={dateOnlySchema.safeParse(sp.depart).data ?? ""}
        initialGuests={typeof sp.voyageurs === "string" && /^[1-9][0-9]*$/.test(sp.voyageurs) ? sp.voyageurs : "1"}
        propertyId={property.id}
        locale={locale}
        property={{ title: property.title, neighborhood: property.neighborhood, city: property.city, pricePerNight: property.pricePerNight }}
        maxGuests={property.maxGuests}
        minDate={isoDate(today)}
        unavailableDates={unavailable.map((a) => isoDate(a.date))}
      />
        </div>
        <aside className="booking-summary surface-card-plain p-4 sm:p-5" aria-label={t("yourStay")}>
          <p className="eyebrow">{t("yourStay")}</p>
          <h2 className="mt-2 text-xl leading-snug">{property.title}</h2>
          <p className="mt-1 text-sm text-muted">{property.neighborhood} · {property.city}</p>
          {property.verification && isVerificationValid(property.verification) ? <div className="mt-4"><VerifiedBadge verification={property.verification} compact/></div> : null}
          <div className="mt-4 border-t border-border pt-4"><p className="text-xs text-muted">{t("priceLabel")}</p><p className="mt-1 text-lg font-semibold tabular-nums">{new Intl.NumberFormat(locale).format(property.pricePerNight)} <span className="text-sm font-medium text-muted">FCFA / {t("nightSingular")}</span></p><p className="mt-1 text-xs leading-relaxed text-muted">{t("estimateNotice")}</p><Link href={`/logements/${property.id}${query}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-verified underline underline-offset-4">{t("backToProperty")}</Link></div>
        </aside>
      </div></div><SiteFooter/></div>
  );
}
