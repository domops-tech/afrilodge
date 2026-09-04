/**
 * Tâche planifiée (CDC §7.3, épic 5.2) : annule les demandes de réservation
 * dont le verrou de calendrier a expiré sans paiement, et libère les jours
 * HELD correspondants. Même modèle d'exécution que
 * scripts/expire-verifications.ts (PrismaClient dédié, pas le client de
 * l'application — voir src/lib/booking/state-machine.ts, non réutilisable
 * ici pour la même raison) : pas d'ordonnanceur hébergé dans ce dépôt (voir
 * décision 0005), à brancher sur un cron système ou l'équivalent de la
 * plateforme d'hébergement. Le paiement lui-même (ce qui empêcherait
 * normalement cette expiration de se déclencher) arrive au Sprint 6 ; ce
 * script pose déjà l'infrastructure attendue par l'épic 5.2.
 *
 * Exécution : npm run bookings:expire-holds
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function expireStaleHolds(now: Date) {
  const candidates = await prisma.booking.findMany({
    where: { status: { in: ["REQUESTED", "ACCEPTED"] }, holdExpiresAt: { lt: now } },
  });

  let expiredCount = 0;
  for (const booking of candidates) {
    await prisma.$transaction([
      prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } }),
      prisma.availabilityDay.deleteMany({
        where: {
          propertyId: booking.propertyId,
          date: { gte: booking.checkIn, lt: booking.checkOut },
          status: "HELD",
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "booking.transition",
          entity: "Booking",
          entityId: booking.id,
          bookingId: booking.id,
          metadata: { from: booking.status, to: "CANCELLED", reason: "hold_expired_unpaid" },
        },
      }),
    ]);
    expiredCount += 1;
  }
  return expiredCount;
}

async function main() {
  const now = new Date();
  const expiredCount = await expireStaleHolds(now);
  console.log(`Verrous de calendrier expirés : ${expiredCount}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
