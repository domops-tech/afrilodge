import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { requireGuestSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";

/**
 * Écran de suivi de la demande (CDC §6.2, épic 5.4) : accessible tant que la
 * session voyageur éphémère est valide (src/lib/auth/guard.ts). Ne montre
 * jamais le bien d'une autre session — `guestSessionId` n'est pas un secret
 * fort, mais la comparaison ci-dessous empêche de parcourir des
 * réservations en devinant des identifiants.
 */
export default async function BookingConfirmationPage({
  params,
}: PageProps<"/[locale]/reserver/confirmation/[bookingId]">) {
  const { locale, bookingId } = await params;
  setRequestLocale(locale);
  const session = await requireGuestSession();
  const t = await getTranslations("booking");
  const format = await getFormatter();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { property: { select: { title: true, neighborhood: true, city: true } } },
  });

  if (!booking || booking.guestSessionId !== session.guestSessionId) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">{t("confirmationTitle")}</h1>

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
      {booking.status === "ACCEPTED" ? <p className="text-sm text-verified">{t("statusAccepted")}</p> : null}
      {booking.status === "CANCELLED" ? <p className="text-sm text-danger">{t("statusCancelled")}</p> : null}

      <Link href="/recherche" className="text-sm font-medium text-accent">
        {t("backToSearch")}
      </Link>
    </div>
  );
}
