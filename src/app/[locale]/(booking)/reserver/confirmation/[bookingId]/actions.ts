"use server";

import { prisma } from "@/lib/db/client";
import { requireGuestSession } from "@/lib/auth/guard";
import { redirect } from "@/i18n/navigation";
import { transitionBooking } from "@/lib/booking/state-machine";
import { startOfUtcDay } from "@/lib/booking/nights";
import { getFullRefundWindowDays } from "@/lib/settings";
import { getPaymentProvider, buildSimulatedWebhookRequest } from "@/lib/payments/simulated";
import { processPaymentWebhook } from "@/lib/payments/webhook-handler";
import { confirmArrivalAndRelease } from "@/lib/payments/release";

/**
 * Confirmation d'arrivée et annulation, côté voyageur (CDC §5.1.7, §6.2.6,
 * épics 6.4, 6.5). Formulaires classiques comme le reste de l'espace
 * propriétaire (§backTo pattern) : chaque échec métier redirige avec
 * `?erreur=code`, lu par la page pour afficher un message.
 */

function backTo(bookingId: string, formData: FormData, error?: string) {
  const locale = (formData.get("locale") as string) || "fr";
  const href = error
    ? `/reserver/confirmation/${bookingId}?erreur=${error}`
    : `/reserver/confirmation/${bookingId}`;
  return redirect({ href, locale });
}

async function loadOwnedBooking(bookingId: string, guestSessionId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { payment: true } });
  if (!booking || booking.guestSessionId !== guestSessionId) {
    throw new Error("Réservation introuvable pour cette session.");
  }
  return booking;
}

/** Confirmation d'arrivée (CDC §5.1.7) : démarre le séjour et ordonne la libération des fonds (§8.6). */
export async function confirmArrivalAction(formData: FormData): Promise<void> {
  const session = await requireGuestSession();
  const bookingId = String(formData.get("bookingId"));
  const booking = await loadOwnedBooking(bookingId, session.guestSessionId);

  if (booking.status !== "PAID" || !booking.payment) {
    return backTo(bookingId, formData, "etat-invalide");
  }

  await confirmArrivalAndRelease(bookingId);

  return backTo(bookingId, formData);
}

/**
 * Annulation (CDC §6.2.6, §8.7) : libre et sans remboursement tant qu'aucun
 * paiement n'a été conservé (REQUESTED/ACCEPTED) ; au-delà (PAID), soumise
 * à la politique globale paramétrable en back-office (délai de
 * remboursement intégral, voir src/lib/settings.ts) — passé ce délai,
 * l'annulation en libre-service n'est pas proposée.
 */
export async function cancelBookingAction(formData: FormData): Promise<void> {
  const session = await requireGuestSession();
  const bookingId = String(formData.get("bookingId"));
  const booking = await loadOwnedBooking(bookingId, session.guestSessionId);

  if (booking.status === "REQUESTED" || booking.status === "ACCEPTED") {
    try {
      await transitionBooking({ bookingId, to: "CANCELLED", metadata: { reason: "guest_cancelled" } });
    } catch {
      return backTo(bookingId, formData, "annulation-impossible");
    }
    await prisma.$transaction([
      prisma.availabilityDay.deleteMany({
        where: { propertyId: booking.propertyId, date: { gte: booking.checkIn, lt: booking.checkOut }, status: "HELD" },
      }),
      ...(booking.payment
        ? [prisma.payment.update({ where: { id: booking.payment.id }, data: { status: "FAILED" as const } })]
        : []),
    ]);
    return backTo(bookingId, formData);
  }

  if (booking.status === "PAID" && booking.payment) {
    const windowDays = await getFullRefundWindowDays();
    const today = startOfUtcDay();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntilCheckIn = Math.floor((booking.checkIn.getTime() - today.getTime()) / msPerDay);

    if (daysUntilCheckIn < windowDays) {
      return backTo(bookingId, formData, "delai-depasse");
    }

    await getPaymentProvider().refund(booking.payment.providerIntentRef, "guest_cancelled");
    const { rawBody, signature } = buildSimulatedWebhookRequest({
      type: "funds.refunded",
      providerIntentRef: booking.payment.providerIntentRef,
    });
    await processPaymentWebhook(rawBody, signature);
    return backTo(bookingId, formData);
  }

  return backTo(bookingId, formData, "annulation-impossible");
}
