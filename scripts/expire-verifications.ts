/**
 * Tâche planifiée (CDC §6.5.2) : fait expirer les mentions dont la date de
 * validité est dépassée, et relance les propriétaires dont la mention
 * expire dans moins de 30 jours. À exécuter quotidiennement — ce dépôt
 * n'héberge pas d'ordonnanceur : brancher sur un cron système, un job
 * planifié de la plateforme d'hébergement, ou l'équivalent. Voir
 * docs/agile/decisions/0005 pour le même choix côté synchronisation
 * différée (pas de tâche de fond persistante dans l'app elle-même).
 *
 * Exécution : npm run verifications:expire
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { isExpiredByClock, needsRenewalReminder } from "../src/lib/verification/badge";
import { getSmsProvider } from "../src/lib/sms/provider";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function expireOutdatedVerifications(now: Date) {
  const candidates = await prisma.verification.findMany({
    where: { status: "ACTIVE" },
    include: { property: { include: { owner: true } } },
  });

  let expiredCount = 0;
  for (const verification of candidates) {
    if (!isExpiredByClock(verification.expiresAt, now)) continue;

    await prisma.$transaction([
      prisma.verification.update({
        where: { id: verification.id },
        data: { status: "EXPIRED" },
      }),
      prisma.property.update({
        where: { id: verification.propertyId },
        data: { status: "UNPUBLISHED" },
      }),
      prisma.auditLog.create({
        data: {
          action: "verification.expired",
          entity: "Verification",
          entityId: verification.id,
          metadata: { propertyId: verification.propertyId },
        },
      }),
    ]);
    expiredCount += 1;
  }
  return expiredCount;
}

async function sendRenewalReminders(now: Date) {
  const candidates = await prisma.verification.findMany({
    where: { status: "ACTIVE", renewalReminderSentAt: null },
    include: { property: { include: { owner: true } } },
  });

  const sms = getSmsProvider();
  let remindedCount = 0;
  for (const verification of candidates) {
    if (!needsRenewalReminder(verification, now)) continue;

    await sms.send({
      to: verification.property.owner.phone,
      body: `Séjours : la vérification de "${verification.property.title}" expire le ${verification.expiresAt.toLocaleDateString("fr-FR")}. Sollicitez une nouvelle visite pour la renouveler.`,
    });

    await prisma.$transaction([
      prisma.verification.update({
        where: { id: verification.id },
        data: { renewalReminderSentAt: now },
      }),
      prisma.notification.create({
        data: {
          channel: "sms",
          recipient: verification.property.owner.phone,
          template: "verification_renewal_reminder",
          sentAt: now,
        },
      }),
    ]);
    remindedCount += 1;
  }
  return remindedCount;
}

async function main() {
  const now = new Date();
  const expiredCount = await expireOutdatedVerifications(now);
  const remindedCount = await sendRenewalReminders(now);
  console.log(`Vérifications expirées : ${expiredCount}. Relances envoyées : ${remindedCount}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
