import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
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
async function handleFundsHeld(paymentId: string, tx: Prisma.TransactionClient) {
  const payment = await tx.payment.update({ where: { id: paymentId }, data: { status: "HELD" } });
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: payment.bookingId },
    include: { property: true },
  });

  await transitionBooking({ bookingId: booking.id, to: "PAID" }, tx);

  const nights = nightsInRange(booking.checkIn, booking.checkOut);
  await tx.availabilityDay.updateMany({
    where: { bookingId: booking.id, propertyId: booking.propertyId, date: { in: nights }, status: "HELD" },
    data: { status: "BOOKED" },
  });

  const rate = await getCommissionRate();
  const commissionAmount = Math.round(payment.amount * rate);
  await Promise.all([
    tx.payment.update({ where: { id: payment.id }, data: { commissionAmount } }),
    tx.commissionEntry.create({ data: { bookingId: booking.id, amount: commissionAmount, rate } }),
    // Coordonnées d'accès (CDC §6.1.5) : masquées jusqu'ici, révélées une fois le paiement confirmé.
    tx.booking.update({ where: { id: booking.id }, data: { accessInfo: buildAccessInfo(booking.property) } }),
  ]);
}

/**
 * Ordre de libération honoré par le PSP (CDC §8.6) — le passage du séjour à
 * « en cours » se joue côté `confirmArrivalAction` (c'est la confirmation
 * d'arrivée, pas la libération elle-même, qui marque le début du séjour) ;
 * cet événement ne touche que le paiement et la commission.
 */
async function handleFundsReleased(paymentId: string, tx: Prisma.TransactionClient) {
  await tx.payment.update({ where: { id: paymentId }, data: { status: "RELEASED" } });
  const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
  await tx.commissionEntry.updateMany({
    where: { bookingId: payment.bookingId, settledAt: null },
    data: { settledAt: new Date() },
  });
}

/** Remboursement confirmé par le PSP (CDC §8.7) — annule la demande, libère le calendrier, aucune commission due. */
async function handleFundsRefunded(paymentId: string, tx: Prisma.TransactionClient) {
  const payment = await tx.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED" } });
  const booking = await tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });

  await transitionBooking({ bookingId: booking.id, to: "CANCELLED", metadata: { reason: "refunded" } }, tx);

  await Promise.all([
    tx.availabilityDay.deleteMany({
      where: { bookingId: booking.id, propertyId: booking.propertyId, date: { gte: booking.checkIn, lt: booking.checkOut }, status: "BOOKED" },
    }),
    tx.commissionEntry.deleteMany({ where: { bookingId: booking.id, settledAt: null } }),
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

  const event = z.object({
    type: z.enum(["funds.held", "funds.released", "funds.refunded"]),
    externalId: z.string().min(1),
    providerIntentRef: z.string().min(1),
  }).parse(JSON.parse(rawBody));

  return prisma.$transaction(async tx => {
    const payment = await tx.payment.findUnique({ where: { providerIntentRef: event.providerIntentRef } });
    if (!payment) throw new Error("Paiement introuvable.");
    // Serialize distinct events for the same payment, including concurrent retries.
    await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${payment.id} FOR UPDATE`;
    const inserted = await tx.paymentEvent.createMany({
      data: [{ paymentId: payment.id, type: event.type, externalId: event.externalId, payload: event }],
      skipDuplicates: true,
    });
    if (inserted.count === 0) return { processed: false };
    const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
    if (event.type === "funds.held" && current.status === "INTENT_CREATED") await handleFundsHeld(payment.id, tx);
    else if (event.type === "funds.released" && current.status === "HELD") await handleFundsReleased(payment.id, tx);
    else if (event.type === "funds.refunded" && current.status === "HELD") await handleFundsRefunded(payment.id, tx);
    else if (!(
      (event.type === "funds.held" && ["HELD", "RELEASED", "REFUNDED"].includes(current.status)) ||
      (event.type === "funds.released" && current.status === "RELEASED") ||
      (event.type === "funds.refunded" && current.status === "REFUNDED")
    )) throw new Error("Événement incompatible avec l’état du paiement.");
    return { processed: true };
  });
}
