import { prisma } from "@/lib/db/client";
import { isVerificationValid, RENEWAL_REMINDER_WINDOW_DAYS } from "@/lib/verification/badge";

export function canRenewVerification(verification: { status: string; expiresAt: Date } | null, now = new Date()) {
  return !verification || verification.status !== "ACTIVE" ||
    verification.expiresAt.getTime() <= now.getTime() + RENEWAL_REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/** Une demande ordinaire à la fois, y compris lors d'un renouvellement. */
export async function requestVerification(propertyId: string, ownerId: string): Promise<boolean> {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${propertyId} FOR UPDATE`;
    const property = await tx.property.findUniqueOrThrow({
      where: { id: propertyId }, include: { verification: true, verificationRequests: true },
    });
    if (property.ownerId !== ownerId) throw new Error("Bien introuvable pour ce compte.");
    if (!canRenewVerification(property.verification) || property.verificationRequests.some(r =>
      ["REQUESTED", "SCHEDULED", "VISITED"].includes(r.status))) return false;
    await tx.verificationRequest.create({ data: { propertyId, ownerId, status: "REQUESTED" } });
    // Une demande anticipée ne retire pas une mention encore valide.
    if (!property.verification || !isVerificationValid(property.verification)) {
      await tx.property.update({ where: { id: propertyId }, data: { status: "PENDING_VERIFICATION" } });
    }
    return true;
  });
}
