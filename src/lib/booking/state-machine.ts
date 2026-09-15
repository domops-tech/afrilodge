import { prisma } from "@/lib/db/client";
import type { $Enums, Prisma } from "@/generated/prisma/client";

/**
 * Machine à états d'une réservation (CDC §7.2). Table de référence unique :
 * aucun code applicatif n'écrit `Booking.status` directement, tout passe
 * par `transitionBooking` ci-dessous, qui journalise chaque changement dans
 * AuditLog. Les call sites (acceptation propriétaire, webhook de paiement,
 * confirmation d'arrivée…) arrivent aux sprints S5-S6 du backlog ; cette
 * fonction est le socle sur lequel ils s'appuient.
 */

export type BookingStatus = $Enums.BookingStatus;

const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  REQUESTED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PAID", "CANCELLED"],
  PAID: ["IN_PROGRESS", "CANCELLED", "DISPUTED"],
  IN_PROGRESS: ["COMPLETED", "DISPUTED"],
  DISPUTED: ["PAID", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: ["DISPUTED"],
  CANCELLED: [],
};

export function isTransitionAllowed(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class InvalidBookingTransitionError extends Error {
  constructor(from: BookingStatus, to: BookingStatus) {
    super(`Transition de réservation refusée : ${from} → ${to}`);
    this.name = "InvalidBookingTransitionError";
  }
}

/**
 * Applique une transition si elle est autorisée, dans une transaction qui
 * journalise le changement. `actorId` est l'utilisateur à l'origine du
 * changement (propriétaire, admin…) ou `null` pour un déclenchement système
 * (expiration de verrou, webhook de paiement).
 */
export async function transitionBooking(params: {
  bookingId: string;
  to: BookingStatus;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}, transaction?: Prisma.TransactionClient) {
  const { bookingId, to, actorId = null, metadata } = params;

  const apply = async (tx: Prisma.TransactionClient) => {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });

    if (!isTransitionAllowed(booking.status, to)) {
      throw new InvalidBookingTransitionError(booking.status, to);
    }

    const updated = await tx.booking.update({
      where: { id: bookingId, status: booking.status },
      data: { status: to },
    });

    await tx.auditLog.create({
      data: {
        action: "booking.transition",
        entity: "Booking",
        entityId: bookingId,
        actorId,
        bookingId,
        metadata: { from: booking.status, to, ...metadata },
      },
    });

    return updated;
  };
  return transaction ? apply(transaction) : prisma.$transaction(apply);
}
