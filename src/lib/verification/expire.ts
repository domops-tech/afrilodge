import type { PrismaClient } from "@/generated/prisma/client";

/** Un candidat peut être périmé quand une approbation intervient entre sa
 * sélection et le cron. Le verrou du bien et visitId protègent le renouvellement. */
export async function expireVerification(
  db: PrismaClient,
  candidate: { id: string; propertyId: string; visitId: string },
  now: Date,
): Promise<boolean> {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${candidate.propertyId} FOR UPDATE`;
    const expired = await tx.verification.updateMany({
      where: { id: candidate.id, visitId: candidate.visitId, status: "ACTIVE", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    });
    if (!expired.count) return false;
    const pending = await tx.verificationRequest.findFirst({
      where: { propertyId: candidate.propertyId, status: { in: ["REQUESTED", "SCHEDULED", "VISITED"] } },
    });
    await tx.property.update({
      where: { id: candidate.propertyId },
      data: { status: pending ? "PENDING_VERIFICATION" : "UNPUBLISHED" },
    });
    await tx.auditLog.create({ data: {
      action: "verification.expired", entity: "Verification", entityId: candidate.id,
      metadata: { propertyId: candidate.propertyId },
    } });
    return true;
  });
}
