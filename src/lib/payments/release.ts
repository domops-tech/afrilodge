import { prisma } from "@/lib/db/client";
import { transitionBooking } from "@/lib/booking/state-machine";
import { getPaymentProvider, buildSimulatedWebhookRequest } from "@/lib/payments/simulated";
import { processPaymentWebhook } from "@/lib/payments/webhook-handler";

/**
 * Démarre le séjour et ordonne la libération des fonds (CDC §5.1.7, §8.6).
 * Déclenché soit par la confirmation d'arrivée du voyageur (épic 6.4, voir
 * (booking)/reserver/confirmation/[bookingId]/actions.ts), soit
 * automatiquement 24h après l'arrivée prévue s'il ne l'a pas fait — "le
 * premier des deux", décision prise avec vous à la planification du
 * Sprint 6 — voir src/app/api/payments/release-overdue/route.ts. Un seul
 * chemin pour les deux déclencheurs : aucune divergence possible entre eux.
 *
 * Idempotente et sûre à rejouer : si `release()` échoue (panne transitoire
 * du PSP, ou référence non conservée par le simulateur — voir décision
 * 0012), l'arrivée reste confirmée (c'est un fait réel, indépendant du
 * paiement) mais le paiement reste `HELD` — voir
 * src/app/api/payments/release-overdue/route.ts, qui retente aussi les
 * libérations restées bloquées, pas seulement les arrivées non confirmées.
 */
export async function confirmArrivalAndRelease(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { payment: true },
  });
  if (!booking.payment) {
    throw new Error(`Aucun paiement associé à la réservation ${bookingId}`);
  }

  if (booking.status === "PAID") {
    await transitionBooking({ bookingId, to: "IN_PROGRESS" });
    await prisma.booking.update({ where: { id: bookingId }, data: { arrivalConfirmedAt: new Date() } });
  }

  if (booking.payment.status === "HELD") {
    // Ordre de libération (appel sortant, CDC §8.6) — l'état du paiement ne
    // change qu'au retour du webhook correspondant, jamais sur la seule foi
    // de cet appel (voir src/lib/payments/webhook-handler.ts).
    await getPaymentProvider().release(booking.payment.providerIntentRef);
    const { rawBody, signature } = buildSimulatedWebhookRequest({
      type: "funds.released",
      providerIntentRef: booking.payment.providerIntentRef,
    });
    await processPaymentWebhook(rawBody, signature);
  }
}
