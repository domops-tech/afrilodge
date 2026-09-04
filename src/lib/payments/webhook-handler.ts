import { prisma } from "@/lib/db/client";
import { getPaymentProvider } from "@/lib/payments/simulated";
import { transitionBooking } from "@/lib/booking/state-machine";
import { nightsInRange } from "@/lib/booking/nights";
import { getCommissionRate } from "@/lib/settings";

/**
 * Traitement des webhooks de paiement (CDC §8.4) — point d'entrée unique,
 * appelé à la fois par la vraie route HTTP (`/api/payments/webhook`, ce
 * qu'appellerait un PSP réel) et par le simulateur (qui construit le même
 * événement signé plutôt que de modifier l'état directement — voir
 * src/lib/payments/simulated.ts). L'état d'un `Payment` ne suit donc
 * jamais un appel sortant (`createIntent`, `release`, `refund`), toujours
 * cet unique chemin vérifié + idempotent (plan — Architecture cible).
 */

export class WebhookVerificationError extends Error {
  constructor() {
    super("Signature de webhook invalide.");
    this.name = "WebhookVerificationError";
  }
}

type IncomingWebhookEvent = {
  type: "funds.held" | "funds.released" | "funds.refunded";
  externalId: string;
  providerIntentRef: string;
};

function buildAccessInfo(property: {
  accessLandmarks: string | null;
  latitude: number | null;
  longitude: number | null;
}): string {
  const parts: string[] = [];
  if (property.accessLandmarks?.trim()) parts.push(property.accessLandmarks.trim());
  if (property.latitude !== null && property.longitude !== null) {
    parts.push(`GPS : ${property.latitude.toFixed(5)}, ${property.longitude.toFixed(5)}`);
  }
  return parts.join(" — ");
}

/** Paiement confirmé par le PSP (CDC §8.1) : la demande devient une réservation payée. */
async function handleFundsHeld(paymentId: string) {
  const payment = await prisma.payment.update({ where: { id: paymentId }, data: { status: "HELD" } });
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: payment.bookingId },
    include: { property: true },
  });

  await transitionBooking({ bookingId: booking.id, to: "PAID" });

  const nights = nightsInRange(booking.checkIn, booking.checkOut);
  await prisma.availabilityDay.updateMany({
    where: { propertyId: booking.propertyId, date: { in: nights }, status: "HELD" },
    data: { status: "BOOKED" },
  });

  const rate = await getCommissionRate();
  const commissionAmount = Math.round(payment.amount * rate);
  await prisma.$transaction([
    prisma.payment.update({ where: { id: payment.id }, data: { commissionAmount } }),
    prisma.commissionEntry.create({ data: { bookingId: booking.id, amount: commissionAmount, rate } }),
    // Coordonnées d'accès (CDC §6.1.5) : masquées jusqu'ici, révélées une fois le paiement confirmé.
    prisma.booking.update({ where: { id: booking.id }, data: { accessInfo: buildAccessInfo(booking.property) } }),
  ]);
}

/**
 * Ordre de libération honoré par le PSP (CDC §8.6) — le passage du séjour à
 * « en cours » se joue côté `confirmArrivalAction` (c'est la confirmation
 * d'arrivée, pas la libération elle-même, qui marque le début du séjour) ;
 * cet événement ne touche que le paiement et la commission.
 */
async function handleFundsReleased(paymentId: string) {
  await prisma.payment.update({ where: { id: paymentId }, data: { status: "RELEASED" } });
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  await prisma.commissionEntry.updateMany({
    where: { bookingId: payment.bookingId, settledAt: null },
    data: { settledAt: new Date() },
  });
}

/** Remboursement confirmé par le PSP (CDC §8.7) — annule la demande, libère le calendrier, aucune commission due. */
async function handleFundsRefunded(paymentId: string) {
  const payment = await prisma.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED" } });
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });

  await transitionBooking({ bookingId: booking.id, to: "CANCELLED", metadata: { reason: "refunded" } });

  await prisma.$transaction([
    prisma.availabilityDay.deleteMany({
      where: { propertyId: booking.propertyId, date: { gte: booking.checkIn, lt: booking.checkOut }, status: "BOOKED" },
    }),
    prisma.commissionEntry.deleteMany({ where: { bookingId: booking.id, settledAt: null } }),
  ]);
}

/**
 * Point d'entrée unique. Idempotence garantie par la contrainte d'unicité
 * sur `PaymentEvent.externalId` : `skipDuplicates` évite la course entre
 * deux livraisons concurrentes du même événement (un simple
 * findUnique-puis-create laisserait une fenêtre où les deux passeraient le
 * contrôle avant qu'aucune n'ait committé).
 */
export async function processPaymentWebhook(
  rawBody: string,
  signatureHeader: string | null
): Promise<{ processed: boolean }> {
  const provider = getPaymentProvider();
  if (!provider.verifyWebhook(rawBody, signatureHeader)) {
    throw new WebhookVerificationError();
  }

  const event = JSON.parse(rawBody) as IncomingWebhookEvent;

  const payment = await prisma.payment.findUnique({ where: { providerIntentRef: event.providerIntentRef } });
  if (!payment) {
    throw new Error(`Paiement introuvable pour la référence ${event.providerIntentRef}`);
  }

  const inserted = await prisma.paymentEvent.createMany({
    data: [{ paymentId: payment.id, type: event.type, externalId: event.externalId, payload: event }],
    skipDuplicates: true,
  });
  if (inserted.count === 0) {
    return { processed: false };
  }

  if (event.type === "funds.held") await handleFundsHeld(payment.id);
  else if (event.type === "funds.released") await handleFundsReleased(payment.id);
  else if (event.type === "funds.refunded") await handleFundsRefunded(payment.id);

  return { processed: true };
}
