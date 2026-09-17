"use server";

import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { isVerificationValid } from "@/lib/verification/badge";
import { prisma } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/guard";
import { redirect } from "@/i18n/navigation";
import { computeExpiresAt } from "@/lib/verification/badge";
import { withdrawVerification } from "@/lib/verification/withdraw";

/**
 * Validation ou refus d'une fiche par le back-office (CDC §4.1.8) —
 * attribue la mention « Vérifié » ou renvoie le bien en brouillon. Une
 * seule décision possible : la garde sur `status === "VISITED"` empêche de
 * rejouer l'action sur une fiche déjà traitée (double clic, deux onglets).
 */

export type DecisionState = { status: "idle" | "error"; message?: string };

async function loadRequestOrThrow(requestId: string, db: Prisma.TransactionClient = prisma) {
  const request = await db.verificationRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { visit: { include: { amenityChecks: true } }, dispute: true },
  });
  if (request.status !== "VISITED" || !request.visit) {
    throw new Error("Fiche non éligible à une décision (déjà traitée ou non visitée).");
  }
  return request;
}

export async function approveVerificationAction(
  _prev: DecisionState,
  formData: FormData
): Promise<DecisionState> {
  const session = await requireRole("ADMIN");
  const requestId = String(formData.get("requestId"));

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "VerificationRequest" WHERE id = ${requestId} FOR UPDATE`;
    const request = await loadRequestOrThrow(requestId, tx);
    if (request.dispute || !request.visit!.completedAt) throw new Error("Visite complète ordinaire requise.");
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${request.propertyId} FOR UPDATE`;
    const previous = await tx.verification.findUnique({ where: { propertyId: request.propertyId } });
    if (previous) {
      await tx.auditLog.create({ data: {
        action: "verification.renewed", entity: "Verification", entityId: previous.id,
        actorId: session.userId,
        metadata: { previous: JSON.parse(JSON.stringify(previous)), requestId },
      } });
    }
    const visitDate = request.visit!.completedAt!;
    const data = {
        propertyId: request.propertyId,
        visitId: request.visit!.id,
        visitDate,
        expiresAt: computeExpiresAt(visitDate),
        status: "ACTIVE",
        approvedBy: session.userId,
        approvedAt: new Date(),
        withdrawnAt: null,
        withdrawnReason: null,
        renewalReminderSentAt: null,
      } as const;
    await tx.verification.upsert({ where: { propertyId: request.propertyId }, create: data, update: data });
    await tx.verificationRequest.update({ where: { id: requestId }, data: { status: "APPROVED" } });
    await tx.property.update({
      where: { id: request.propertyId },
      data: {
        status: "PUBLISHED",
        // Filet de sécurité : normalement déjà copié à la synchronisation
        // (src/app/api/terrain/visits/[visitId]/sync/route.ts), mais toute
        // visite ne passe pas nécessairement par cette route (ex. données
        // de démonstration insérées directement — voir prisma/seed.ts).
        latitude: request.visit!.checkInLatitude ?? undefined,
        longitude: request.visit!.checkInLongitude ?? undefined,
      },
    });

    // La fiche publique n'affiche que les équipements réellement constatés
    // (CDC §6.1.3), pas la seule déclaration du propriétaire — voir
    // prisma/schema.prisma, PropertyAmenity.confirmed.
    for (const check of request.visit!.amenityChecks) {
      await tx.propertyAmenity.updateMany({
        where: { propertyId: request.propertyId, name: check.amenityName },
        data: { confirmed: check.observed },
      });
    }
    await tx.auditLog.create({
      data: {
        action: "verification.approved",
        entity: "VerificationRequest",
        entityId: requestId,
        actorId: session.userId,
      },
    });
  });

  return redirect({
    href: "/admin",
    locale: (formData.get("locale") as string) || "fr",
  });
}

/**
 * Issue d'une contre-visite (CDC §6.5.3, épic 7.3) : deux décisions
 * distinctes de l'approbation/refus normales, une nouvelle Verification ne
 * peut de toute façon pas être créée ici (`Verification.propertyId` est
 * unique — le bien en a déjà une). La fiche se referme dans les deux cas
 * (`REJECTED` : ni approuvée ni republiable telle quelle), seul le sort de
 * la mention et du litige diffère.
 */
async function loadDisputeRequestOrThrow(requestId: string) {
  const request = await loadRequestOrThrow(requestId);
  if (!request.dispute) {
    throw new Error("Cette fiche n'est pas liée à un litige.");
  }
  return { ...request, dispute: request.dispute };
}

/** Écart confirmé par la contre-visite : la mention est retirée (CDC §4.2 dernier point, §6.5.3). */
export async function confirmDiscrepancyAction(
  _prev: DecisionState,
  formData: FormData
): Promise<DecisionState> {
  const session = await requireRole("ADMIN");
  const requestId = String(formData.get("requestId"));
  const request = await loadDisputeRequestOrThrow(requestId);

  const reason = "Contre-visite : écart confirmé, mention retirée.";
  await withdrawVerification({
    verificationId: request.dispute.verificationId,
    propertyId: request.propertyId,
    reason,
    actorId: session.userId,
  });
  await prisma.$transaction([
    prisma.verificationRequest.update({ where: { id: requestId }, data: { status: "REJECTED", rejectionReason: reason } }),
    prisma.dispute.update({
      where: { id: request.dispute.id },
      data: { status: "RESOLVED_WITHDRAWN", resolutionNote: reason, resolvedAt: new Date() },
    }),
  ]);

  return redirect({ href: "/admin", locale: (formData.get("locale") as string) || "fr" });
}

/** Écart non confirmé par la contre-visite : la mention est maintenue (CDC §6.5.3). */
export async function dismissDisputeAction(
  _prev: DecisionState,
  formData: FormData
): Promise<DecisionState> {
  const session = await requireRole("ADMIN");
  const requestId = String(formData.get("requestId"));
  const request = await loadDisputeRequestOrThrow(requestId);

  const reason = "Contre-visite : écart non confirmé, mention maintenue.";
  await prisma.$transaction([
    prisma.verificationRequest.update({ where: { id: requestId }, data: { status: "REJECTED", rejectionReason: reason } }),
    prisma.dispute.update({
      where: { id: request.dispute.id },
      data: { status: "RESOLVED_KEPT", resolutionNote: reason, resolvedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: { action: "dispute.dismissed", entity: "Dispute", entityId: request.dispute.id, actorId: session.userId },
    }),
  ]);

  return redirect({ href: "/admin", locale: (formData.get("locale") as string) || "fr" });
}

const rejectSchema = z.object({
  reason: z.string().trim().min(5, "Motif de refus trop court"),
});

export async function rejectVerificationAction(
  _prev: DecisionState,
  formData: FormData
): Promise<DecisionState> {
  const session = await requireRole("ADMIN");
  const requestId = String(formData.get("requestId"));

  const parsed = rejectSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) {
    return { status: "error", message: "reason_required" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "VerificationRequest" WHERE id = ${requestId} FOR UPDATE`;
    const pending = await loadRequestOrThrow(requestId, tx);
    if (pending.dispute) throw new Error("Utiliser la décision de contre-visite.");
    await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${pending.propertyId} FOR UPDATE`;
    const request = await tx.verificationRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED", rejectionReason: parsed.data.reason },
    });
    const verification = await tx.verification.findUnique({ where: { propertyId: request.propertyId } });
    const status = verification && isVerificationValid(verification) ? "PUBLISHED" : verification ? "UNPUBLISHED" : "DRAFT";
    await tx.property.update({ where: { id: request.propertyId }, data: { status } });
    await tx.auditLog.create({
      data: {
        action: "verification.rejected",
        entity: "VerificationRequest",
        entityId: requestId,
        actorId: session.userId,
        metadata: { reason: parsed.data.reason },
      },
    });
  });

  return redirect({
    href: "/admin",
    locale: (formData.get("locale") as string) || "fr",
  });
}
