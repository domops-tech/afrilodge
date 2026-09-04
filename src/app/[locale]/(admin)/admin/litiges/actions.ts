"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/guard";
import { redirect } from "@/i18n/navigation";
import { withdrawVerification } from "@/lib/verification/withdraw";

/**
 * Traitement des litiges au back-office (CDC §6.5.3, épic 7.4) : soit une
 * contre-visite (épic 7.2 — la décision se joue ensuite sur la fiche visitée,
 * voir fiches/[requestId]/DisputeReviewPanel), soit une résolution directe
 * quand le signalement ne justifie pas de renvoyer un agent sur place.
 */

function backTo(formData: FormData, error?: string) {
  const locale = (formData.get("locale") as string) || "fr";
  const href = error ? `/admin/litiges?erreur=${error}` : "/admin/litiges";
  return redirect({ href, locale });
}

/** Déclenche une contre-visite (CDC §6.5.3, épic 7.2) — une VerificationRequest comme une autre, plantée dans la même file de planification admin. */
export async function triggerCounterVisitAction(formData: FormData): Promise<void> {
  const session = await requireRole("ADMIN");
  const disputeId = String(formData.get("disputeId"));

  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId }, include: { property: true } });
  if (!dispute || dispute.status !== "OPEN" || dispute.counterVisitRequestId) {
    return backTo(formData, "action-impossible");
  }

  await prisma.$transaction(async (tx) => {
    const request = await tx.verificationRequest.create({
      data: { propertyId: dispute.propertyId, ownerId: dispute.property.ownerId, packPaid: false },
    });
    await tx.dispute.update({
      where: { id: disputeId },
      data: { status: "COUNTER_VISIT_SCHEDULED", counterVisitRequestId: request.id },
    });
    await tx.auditLog.create({
      data: {
        action: "dispute.counter_visit_triggered",
        entity: "Dispute",
        entityId: disputeId,
        actorId: session.userId,
      },
    });
  });

  return backTo(formData);
}

const resolveSchema = z.object({
  disputeId: z.string().min(1),
  outcome: z.enum(["kept", "withdrawn"]),
  note: z.string().trim().min(5),
});

/** Résolution directe, sans contre-visite (CDC §6.5.3, épic 7.4) — quand l'admin peut décider à partir du seul signalement. */
export async function resolveDisputeDirectlyAction(formData: FormData): Promise<void> {
  const session = await requireRole("ADMIN");

  const parsed = resolveSchema.safeParse({
    disputeId: formData.get("disputeId"),
    outcome: formData.get("outcome"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return backTo(formData, "motif-requis");
  }

  const dispute = await prisma.dispute.findUnique({ where: { id: parsed.data.disputeId } });
  if (!dispute || dispute.status !== "OPEN") {
    return backTo(formData, "action-impossible");
  }

  if (parsed.data.outcome === "withdrawn") {
    await withdrawVerification({
      verificationId: dispute.verificationId,
      propertyId: dispute.propertyId,
      reason: parsed.data.note,
      actorId: session.userId,
    });
  }

  await prisma.dispute.update({
    where: { id: dispute.id },
    data: {
      status: parsed.data.outcome === "withdrawn" ? "RESOLVED_WITHDRAWN" : "RESOLVED_KEPT",
      resolutionNote: parsed.data.note,
      resolvedAt: new Date(),
    },
  });

  return backTo(formData);
}
