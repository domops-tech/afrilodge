"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/guard";
import { redirect } from "@/i18n/navigation";
import { computeExpiresAt } from "@/lib/verification/badge";

/**
 * Validation ou refus d'une fiche par le back-office (CDC §4.1.8) —
 * attribue la mention « Vérifié » ou renvoie le bien en brouillon. Une
 * seule décision possible : la garde sur `status === "VISITED"` empêche de
 * rejouer l'action sur une fiche déjà traitée (double clic, deux onglets).
 */

export type DecisionState = { status: "idle" | "error"; message?: string };

async function loadRequestOrThrow(requestId: string) {
  const request = await prisma.verificationRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { visit: true },
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

  const request = await loadRequestOrThrow(requestId);
  const visitDate = request.visit!.completedAt ?? request.visit!.checkInAt ?? new Date();

  await prisma.$transaction(async (tx) => {
    await tx.verification.create({
      data: {
        propertyId: request.propertyId,
        visitId: request.visit!.id,
        visitDate,
        expiresAt: computeExpiresAt(visitDate),
        status: "ACTIVE",
        approvedBy: session.userId,
        approvedAt: new Date(),
      },
    });
    await tx.verificationRequest.update({ where: { id: requestId }, data: { status: "APPROVED" } });
    await tx.property.update({ where: { id: request.propertyId }, data: { status: "PUBLISHED" } });
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

  await loadRequestOrThrow(requestId);

  await prisma.$transaction(async (tx) => {
    const request = await tx.verificationRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    });
    await tx.property.update({ where: { id: request.propertyId }, data: { status: "DRAFT" } });
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
