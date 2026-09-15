"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/guard";
import { redirect } from "@/i18n/navigation";
import { phoneSchema } from "@/lib/auth/login-flow";

/**
 * Création d'un compte agent par l'administrateur (CDC §3 : compte
 * provisionné par VD Technologies, jamais d'auto-inscription — voir
 * src/app/[locale]/(field)/terrain/connexion/actions.ts). Jusqu'ici la
 * seule voie était une insertion manuelle en base ; cette page l'ouvre au
 * back-office.
 *
 * L'email est OBLIGATOIRE ici, alors qu'il reste optionnel partout ailleurs
 * (canal de secours, décision 0014) : tant qu'aucun opérateur SMS réel
 * n'est branché (SMS_PROVIDER="console" uniquement en production, décision
 * 0013), un agent créé sans email n'a aucun moyen de recevoir son code de
 * connexion. `requestLoginOtp` envoie déjà ce code par email quand le
 * compte en a un enregistré, même si le formulaire de connexion agent ne
 * montre pas ce champ (voir OtpLoginForm, showEmailField=false pour
 * l'agent) — c'est ce mécanisme existant que cette contrainte exploite.
 * À retirer le jour où un opérateur SMS réel est branché.
 */

const createAgentSchema = z.object({
  fullName: z.string().trim().min(2),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email(),
});

export type CreateAgentState = { status: "idle" | "error"; message?: string };

export async function createAgentAction(
  _prev: CreateAgentState,
  formData: FormData
): Promise<CreateAgentState> {
  const session = await requireRole("ADMIN");

  const parsed = createAgentSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { status: "error", message: "invalid" };
  }
  const phone = parsed.data.phone.replace(/\s+/g, "");

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    return { status: "error", message: "phone_taken" };
  }

  const agent = await prisma.user.create({
    data: { role: "AGENT", phone, email: parsed.data.email, fullName: parsed.data.fullName },
  });

  await prisma.auditLog.create({
    data: {
      action: "user.created",
      entity: "User",
      entityId: agent.id,
      actorId: session.userId,
      metadata: { role: "AGENT" },
    },
  });

  return redirect({ href: "/admin/agents", locale: (formData.get("locale") as string) || "fr" });
}
