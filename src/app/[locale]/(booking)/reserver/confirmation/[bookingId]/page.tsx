import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { requireGuestSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { confirmArrivalAction, cancelBookingAction, reportDisputeAction } from "./actions";

/**
 * Écran de suivi de la demande (CDC §6.2, épics 5.4, 6.1-6.5) : accessible
 * tant que la session voyageur éphémère est valide (src/lib/auth/guard.ts).
 * Ne montre jamais le bien d'une autre session — `guestSessionId` n'est pas
 * un secret fort, mais la comparaison ci-dessous empêche de parcourir des
 * réservations en devinant des identifiants.
 */
export default async function BookingConfirmationPage({
  params,
  searchParams,
}: PageProps<"/[locale]/reserver/confirmation/[bookingId]">) {
  const { locale, bookingId } = await params;
  const { erreur } = await searchParams;
  setRequestLocale(locale);
  const session = await requireGuestSession();
  const t = await getTranslations("booking");
  const format = await getFormatter();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: { select: { title: true, neighborhood: true, city: true } },
      payment: true,
      dispute: true,
    },
  });

  if (!booking || booking.guestSessionId !== session.guestSessionId) {
    notFound();
  }

  const canCancelFreely = booking.status === "REQUESTED" || booking.status === "ACCEPTED";
  const canCancelWithPolicy = booking.status === "PAID";

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">{t("confirmationTitle")}</h1>

      {typeof erreur === "string" ? (
        <p className="rounded-[var(--radius-default)] bg-danger/10 p-3 text-sm text-danger">
          {t(`error.${erreur}`)}
        </p>
      ) : null}

      <Card className="flex flex-col gap-2 text-sm">
        <span className="font-medium">{booking.property.title}</span>
        <span className="text-muted">
          {booking.property.neighborhood}, {booking.property.city}
        </span>
        <span>
          {format.dateTime(booking.checkIn, { dateStyle: "long" })} →{" "}
          {format.dateTime(booking.checkOut, { dateStyle: "long" })}
        </span>
        <span>{t("guestsCount", { count: booking.guests })}</span>
      </Card>

      {booking.status === "REQUESTED" ? <p className="text-sm">{t("statusRequested")}</p> : null}

      {booking.status === "ACCEPTED" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-verified">{t("statusAccepted")}</p>
          <Link href={`/reserver/paiement/${booking.id}`}>
            <Button className="w-full">{t("payNowCta")}</Button>
          </Link>
        </div>
      ) : null}

      {booking.status === "PAID" || booking.status === "IN_PROGRESS" ? (
        <Card className="flex flex-col gap-2 text-sm">
          <p className="font-medium text-verified">
            {booking.status === "PAID" ? t("statusPaid") : t("statusInProgress")}
          </p>
          <span>{t("stayCodeLabel", { code: booking.stayCode })}</span>
          {booking.accessInfo ? <span className="text-muted">{booking.accessInfo}</span> : null}
        </Card>
      ) : null}

      {booking.status === "PAID" ? (
        <form action={confirmArrivalAction}>
          <input type="hidden" name="bookingId" value={booking.id} />
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" className="w-full">
            {t("confirmArrivalCta")}
          </Button>
        </form>
      ) : null}

      {booking.status === "CANCELLED" ? <p className="text-sm text-danger">{t("statusCancelled")}</p> : null}

      {booking.status === "IN_PROGRESS" ? (
        booking.dispute ? (
          <Card className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("disputeTitle")}</span>
            <span className="text-muted">{t(`disputeStatus.${booking.dispute.status}`)}</span>
            {booking.dispute.resolutionNote ? <span>{booking.dispute.resolutionNote}</span> : null}
          </Card>
        ) : (
          <form action={reportDisputeAction} className="flex flex-col gap-3">
            <input type="hidden" name="bookingId" value={booking.id} />
            <input type="hidden" name="locale" value={locale} />
            <Field id="reason" name="reason" label={t("reportDisputeLabel")} required />
            <Button type="submit" variant="secondary" className="w-full">
              {t("reportDisputeCta")}
            </Button>
          </form>
        )
      ) : null}

      {canCancelFreely || canCancelWithPolicy ? (
        <form action={cancelBookingAction}>
          <input type="hidden" name="bookingId" value={booking.id} />
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="secondary" className="w-full">
            {t("cancelCta")}
          </Button>
        </form>
      ) : null}

      <Link href="/recherche" className="text-sm font-medium text-accent">
        {t("backToSearch")}
      </Link>
    </div>
  );
}
