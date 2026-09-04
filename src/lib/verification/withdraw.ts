import { prisma } from "@/lib/db/client";

/**
 * Retrait de mention (CDC §4.2 dernier point, §6.5.3, épic 7.3/7.4) — seul
 * point d'écriture pour cette transition, appelé aussi bien depuis la
 * résolution directe d'un litige (sans contre-visite) que depuis la
 * décision d'une contre-visite défavorable. Même principe que
 * `transitionBooking` : une seule fonction, jamais rejouée à la main
 * ailleurs.
 */
export async function withdrawVerification(params: {
  verificationId: string | null;
  propertyId: string;
  reason: string;
  actorId: string;
}): Promise<void> {
  const { verificationId, propertyId, reason, actorId } = params;

  await prisma.$transaction(async (tx) => {
    if (verificationId) {
      await tx.verification.update({
        where: { id: verificationId },
        data: { status: "WITHDRAWN", withdrawnAt: new Date(), withdrawnReason: reason },
      });
    }
    await tx.property.update({ where: { id: propertyId }, data: { status: "UNPUBLISHED" } });
    await tx.auditLog.create({
      data: {
        action: "verification.withdrawn",
        entity: "Property",
        entityId: propertyId,
        actorId,
        metadata: { reason, verificationId },
      },
    });
  });
}
