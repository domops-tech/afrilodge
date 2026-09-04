import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { isVerificationValid } from "@/lib/verification/badge";
import { AMENITY_OPTIONS } from "@/lib/property/amenities";
import {
  updatePropertyAction,
  requestVerificationAction,
  updateAmenitiesAction,
  updateAvailabilityAction,
} from "./actions";

const CALENDAR_WINDOW_DAYS = 60;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Gestion d'un bien (CDC §6.3) : édition, demande de vérification, suivi de
// traitement, équipements, calendrier, réservations, règlements.
export default async function PropertyManagePage({
  params,
  searchParams,
}: PageProps<"/[locale]/proprietaire/biens/[propertyId]">) {
  const { locale, propertyId } = await params;
  const { erreur } = await searchParams;
  setRequestLocale(locale);
  const session = await requireRole("OWNER");
  const t = await getTranslations("owner");
  const tVerif = await getTranslations("verification");
  const format = await getFormatter();

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      amenities: true,
      verification: true,
      verificationRequests: { orderBy: { createdAt: "desc" }, take: 1, include: { visit: true } },
      bookings: { include: { payment: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!property || property.ownerId !== session.userId) {
    notFound();
  }

  const latestRequest = property.verificationRequests[0];
  const hasVisit = Boolean(latestRequest?.visit);
  const canRequestVerification = !latestRequest || latestRequest.status === "REJECTED";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + CALENDAR_WINDOW_DAYS);
  const availability = await prisma.availabilityDay.findMany({
    where: { propertyId, date: { gte: today, lt: windowEnd } },
  });
  const availabilityByDate = new Map(availability.map((a) => [toIsoDate(a.date), a.status]));
  const calendarDays = Array.from({ length: CALENDAR_WINDOW_DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  const bookingIds = property.bookings.map((b) => b.id);
  const commissionEntries =
    bookingIds.length > 0
      ? await prisma.commissionEntry.findMany({ where: { bookingId: { in: bookingIds } } })
      : [];
  const commissionByBookingId = new Map(commissionEntries.map((c) => [c.bookingId, c]));

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 py-8">
      <Link href="/proprietaire" className="text-xs text-muted">
        ← {t("backToDashboard")}
      </Link>

      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{property.title}</h1>
        {property.verification && isVerificationValid(property.verification) ? (
          <VerifiedBadge verification={property.verification} />
        ) : null}
      </header>

      {typeof erreur === "string" ? (
        <p className="rounded-[var(--radius-default)] bg-danger/10 p-3 text-sm text-danger">
          {t(`error.${erreur}`)}
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-medium">{t("editSectionTitle")}</h2>
        <form action={updatePropertyAction} className="flex max-w-lg flex-col gap-4">
          <input type="hidden" name="propertyId" value={property.id} />
          <input type="hidden" name="locale" value={locale} />
          <Field id="title" name="title" label={t("titleLabel")} defaultValue={property.title} required />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("descriptionLabel")}</span>
            <textarea
              id="description"
              name="description"
              defaultValue={property.description}
              required
              minLength={10}
              className="min-h-24 rounded-[var(--radius-default)] border border-border bg-background p-3 text-base"
            />
          </label>
          <Field
            id="pricePerNight"
            name="pricePerNight"
            type="number"
            min={1}
            label={t("priceLabel")}
            defaultValue={property.pricePerNight.toString()}
            required
          />
          <Field
            id="maxGuests"
            name="maxGuests"
            type="number"
            min={1}
            label={t("maxGuestsLabel")}
            defaultValue={property.maxGuests.toString()}
            required
          />
          <Button type="submit" className="self-start">
            {t("saveCta")}
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t("verificationSectionTitle")}</h2>
        {!latestRequest ? (
          <form action={requestVerificationAction}>
            <input type="hidden" name="propertyId" value={property.id} />
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit">{t("requestVerificationCta")}</Button>
          </form>
        ) : (
          <>
            {latestRequest.status === "REQUESTED" ? <p className="text-sm">{t("verificationRequested")}</p> : null}
            {latestRequest.status === "SCHEDULED" && latestRequest.visit ? (
              <p className="text-sm">
                {t("verificationScheduled", {
                  date: format.dateTime(latestRequest.visit.scheduledAt, { dateStyle: "long" }),
                })}
              </p>
            ) : null}
            {latestRequest.status === "VISITED" ? <p className="text-sm">{t("verificationVisited")}</p> : null}
            {latestRequest.status === "APPROVED" ? <p className="text-sm">{t("verificationApproved")}</p> : null}
            {latestRequest.status === "REJECTED" ? (
              <>
                <p className="text-sm text-danger">
                  {t("verificationRejected", { reason: latestRequest.rejectionReason ?? "" })}
                </p>
                {canRequestVerification ? (
                  <form action={requestVerificationAction}>
                    <input type="hidden" name="propertyId" value={property.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <Button type="submit" variant="secondary">
                      {t("requestAgainCta")}
                    </Button>
                  </form>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t("amenitiesLabel")}</h2>
        {hasVisit ? (
          <>
            <p className="text-xs text-muted">{t("amenitiesLockedNotice")}</p>
            <ul className="flex flex-wrap gap-2">
              {property.amenities.map((a) => (
                <li key={a.id} className="rounded-full bg-surface px-3 py-1 text-sm">
                  {a.name} {a.confirmed ? tVerif("badge") : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <form action={updateAmenitiesAction} className="flex flex-col gap-2">
            <input type="hidden" name="propertyId" value={property.id} />
            <input type="hidden" name="locale" value={locale} />
            <p className="text-xs text-muted">{t("amenitiesEditableNotice")}</p>
            {AMENITY_OPTIONS.map((name) => (
              <label key={name} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={`amenity_${name}`}
                  defaultChecked={property.amenities.some((a) => a.name === name)}
                  className="h-5 w-5"
                />
                {name}
              </label>
            ))}
            <Button type="submit" variant="secondary" className="self-start">
              {t("saveCta")}
            </Button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t("calendarTitle")}</h2>
        <p className="text-xs text-muted">{t("calendarHint")}</p>
        <form action={updateAvailabilityAction} className="flex flex-col gap-3">
          <input type="hidden" name="propertyId" value={property.id} />
          <input type="hidden" name="locale" value={locale} />
          <div className="flex flex-wrap gap-1.5">
            {calendarDays.map((day) => {
              const iso = toIsoDate(day);
              const status = availabilityByDate.get(iso);
              const locked = status === "HELD" || status === "BOOKED";
              return (
                <label
                  key={iso}
                  className={`flex h-9 w-9 items-center justify-center rounded text-xs ${
                    locked
                      ? "cursor-not-allowed bg-border text-muted"
                      : "cursor-pointer border border-border has-checked:bg-danger has-checked:text-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="blockedDate"
                    value={iso}
                    defaultChecked={status === "BLOCKED"}
                    disabled={locked}
                    className="sr-only"
                  />
                  {day.getDate()}
                </label>
              );
            })}
          </div>
          <Button type="submit" variant="secondary" className="self-start">
            {t("calendarSave")}
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t("bookingsTitle")}</h2>
        {property.bookings.length === 0 ? (
          <p className="text-sm text-muted">{t("noBookings")}</p>
        ) : (
          property.bookings.map((booking) => (
            <Card key={booking.id} className="flex flex-col gap-1 text-sm">
              <span>
                {format.dateTime(booking.checkIn, { dateStyle: "medium" })} →{" "}
                {format.dateTime(booking.checkOut, { dateStyle: "medium" })}
              </span>
              <span className="text-muted">{booking.status}</span>
            </Card>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t("paymentsTitle")}</h2>
        {property.bookings.every((b) => !b.payment) ? (
          <p className="text-sm text-muted">{t("noPayments")}</p>
        ) : (
          property.bookings
            .filter((b) => b.payment)
            .map((booking) => {
              const commission = commissionByBookingId.get(booking.id);
              return (
                <Card key={booking.id} className="flex flex-col gap-1 text-sm">
                  <span>
                    {booking.payment!.amount} FCFA · {booking.payment!.status}
                  </span>
                  {commission ? <span className="text-muted">Commission : {commission.amount} FCFA</span> : null}
                </Card>
              );
            })
        )}
      </section>
    </div>
  );
}
