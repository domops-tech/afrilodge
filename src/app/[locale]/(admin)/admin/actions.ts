"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/guard";
import { redirect } from "@/i18n/navigation";

/**
 * Planification d'une visite (CDC §4.1.2 : "un rendez-vous est planifié et
 * affecté à un agent"). Manquait au back-office construit au Sprint 2, qui
 * ne couvrait que la validation des fiches déjà visitées — sans cette
 * action, une demande de vérification n'a jamais de suite. Trouvé en
 * construisant le Sprint 4 (le propriétaire peut désormais réellement
 * soumettre une demande, qui doit aboutir quelque part).
 */

export type ScheduleState = { status: "idle" | "error"; message?: string };

const scheduleSchema = z.object({
  requestId: z.string().min(1),
  agentId: z.string().min(1),
  scheduledAt: z.string().min(1),
});

export async function scheduleVisitAction(
  _prev: ScheduleState,
  formData: FormData
): Promise<ScheduleState> {
  const session = await requireRole("ADMIN");

  const parsed = scheduleSchema.safeParse({
    requestId: formData.get("requestId"),
    agentId: formData.get("agentId"),
    scheduledAt: formData.get("scheduledAt"),
  });
  if (!parsed.success) {
    return { status: "error", message: "invalid" };
  }

  const request = await prisma.verificationRequest.findUnique({
    where: { id: parsed.data.requestId },
  });
  if (!request || request.status !== "REQUESTED") {
    return { status: "error", message: "not_requestable" };
  }

  const agent = await prisma.user.findUnique({ where: { id: parsed.data.agentId } });
  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (!agent || agent.role !== "AGENT" || !Number.isFinite(scheduledAt.getTime())) {
    return { status: "error", message: "invalid" };
  }

  await prisma.$transaction([
    prisma.visit.create({
      data: {
        verificationRequestId: request.id,
        agentId: parsed.data.agentId,
        scheduledAt: new Date(parsed.data.scheduledAt),
      },
    }),
    prisma.verificationRequest.update({ where: { id: request.id }, data: { status: "SCHEDULED" } }),
    prisma.auditLog.create({
      data: {
        action: "verification.scheduled",
        entity: "VerificationRequest",
        entityId: request.id,
        actorId: session.userId,
      },
    }),
  ]);

  return redirect({ href: "/admin", locale: (formData.get("locale") as string) || "fr" });
}
