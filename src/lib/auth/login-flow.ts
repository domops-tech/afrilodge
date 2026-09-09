import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requestOtp, verifyOtp, OtpRateLimitError, type OtpPurpose } from "@/lib/auth/otp";
import { createUserSession, type UserRole } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";

/**
 * Connexion téléphone + OTP partagée par les quatre surfaces (CDC §3).
 * Propriétaire : première connexion crée le compte (§5.2.16). Agent et
 * administrateur : comptes provisionnés par VD Technologies, jamais créés
 * depuis cette page — voir `requireExistingRole`/`allowSelfSignup`.
 *
 * L'email est un canal de secours optionnel pour le code (décision 0014) :
 * jamais requis, jamais un substitut au téléphone.
 */

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{8,15}$/, "Numéro de téléphone invalide");

export const emailSchema = z
  .preprocess(
    // FormData.get("email") renvoie `null` quand le champ n'existe même pas
    // dans le formulaire (agent/admin : pas de champ email, voir
    // OtpLoginForm — showEmailField) — pas `""`. z.string().optional() ne
    // couvre pas `null`, seulement `undefined` ; sans ce prétraitement,
    // toute connexion sans champ email visible échouait silencieusement en
    // "invalid_email" avant même l'envoi du code (constaté en e2e).
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : ""),
    z.literal("").or(z.string().email("Email invalide"))
  )
  .transform((value) => (value ? value : undefined));

export type RequestOtpState = { status: "idle" | "sent" | "error"; message?: string };

export async function requestLoginOtp(
  formData: FormData,
  purpose: OtpPurpose,
  options?: { requireExistingRole?: UserRole }
): Promise<RequestOtpState> {
  const parsedPhone = phoneSchema.safeParse(formData.get("phone"));
  if (!parsedPhone.success) {
    return { status: "error", message: "invalid_phone" };
  }
  const phone = parsedPhone.data.replace(/\s+/g, "");

  const parsedEmail = emailSchema.safeParse(formData.get("email"));
  if (!parsedEmail.success) {
    return { status: "error", message: "invalid_email" };
  }

  // Cherché même hors `requireExistingRole` (le propriétaire peut déjà
  // exister sans que cette connexion l'exige) : un compte déjà enregistré
  // garde son email de secours d'une connexion à l'autre, sans avoir à le
  // ressaisir — voir décision 0014.
  const existingUser = await prisma.user.findUnique({ where: { phone } });

  if (options?.requireExistingRole) {
    if (!existingUser || existingUser.role !== options.requireExistingRole) {
      return { status: "error", message: "not_recognized" };
    }
  }

  const email = existingUser?.email ?? parsedEmail.data;

  try {
    await requestOtp({ phone, purpose, email });
  } catch (err) {
    if (err instanceof OtpRateLimitError) {
      return { status: "error", message: "rate_limited" };
    }
    throw err;
  }

  return { status: "sent" };
}

export type VerifyOtpState = { status: "idle" | "error"; message?: string };

export async function verifyLoginOtp(
  formData: FormData,
  purpose: OtpPurpose,
  options: { role: UserRole; allowSelfSignup: boolean; redirectHref: string }
): Promise<VerifyOtpState> {
  const phone = String(formData.get("phone") ?? "").replace(/\s+/g, "");
  const code = String(formData.get("code") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  // Simple validation ici : déjà vérifié (ou laissé vide) à l'étape de
  // demande du code — voir requestLoginOtp. Un email invalide à ce stade
  // est ignoré plutôt que bloquant, la connexion ne doit jamais dépendre
  // de ce champ optionnel.
  const email = emailSchema.safeParse(formData.get("email")).data || undefined;

  const result = await verifyOtp({ phone, purpose, code });
  if (!result.ok) {
    return { status: "error", message: result.reason };
  }

  let user = result.userId ? await prisma.user.findUnique({ where: { id: result.userId } }) : null;
  if (!user) user = await prisma.user.findUnique({ where: { phone } });

  if (!user) {
    if (!options.allowSelfSignup) {
      return { status: "error", message: "not_recognized" };
    }
    user = await prisma.user.create({
      data: { phone, role: options.role, fullName: fullName || phone, email },
    });
  }

  await createUserSession(user.id, options.role);
  return redirect({ href: options.redirectHref, locale: (formData.get("locale") as string) || "fr" });
}
