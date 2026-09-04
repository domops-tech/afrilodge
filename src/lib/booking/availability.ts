import { prisma } from "@/lib/db/client";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Un intervalle [checkIn, checkOut) est disponible si aucune journée de la
 * période ne porte un statut autre que OPEN — absence de ligne = OPEN
 * (convention établie au Sprint 3, recherche publique). Accepte un client
 * de transaction pour permettre une revérification atomique juste avant la
 * pose du verrou (épic 5.2, CDC §6.2.1 "temps réel") : le temps passé dans
 * le tunnel de réservation suffit à ce qu'un autre voyageur ait réservé les
 * mêmes dates entre deux étapes.
 */
export async function isRangeAvailable(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<boolean> {
  const conflict = await tx.availabilityDay.findFirst({
    where: { propertyId, date: { gte: checkIn, lt: checkOut }, status: { not: "OPEN" } },
  });
  return conflict === null;
}
