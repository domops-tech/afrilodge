import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requestOtp, requestEmailOtp, verifyOtp, OtpRateLimitError, type OtpPurpose } from "@/lib/auth/otp";
import { createUserSession, type UserRole } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";

/**
 * Connexion téléphone-OU-email + OTP partagée par les trois surfaces à
 * compte (propriétaire, agent, admin — CDC §3). Un seul champ, détecté ici
 * plutôt que deux formulaires séparés (l'admin en portait deux jusqu'au
 * 15/09 : « Envoyer le code » et « Envoyer le code par email »). Le
 * voyageur garde son propre champ téléphone dans BookingWizard.tsx : CDC
 * §6.2.2 l'impose, hors périmètre de ce module.
 *
 * Auto-inscription par EMAIL : jamais possible, pour aucun rôle — le
 * schéma exige un `User.phone`, qu'un email seul ne fournit pas. Seul le
 * téléphone peut créer un compte (propriétaire uniquement, §5.2.16).
 *
 * Contrôle de rôle : appliqué systématiquement, y compris quand
 * `allowSelfSignup` est vrai. Avant ce module, la connexion propriétaire
 * ne vérifiait le rôle d'un compte existant que si une auto-inscription
 * était refusée (agent/admin) — un compte agent qui se connectait sur
 * `/connexion` avec son propre téléphone obtenait une session marquée
 * `role: "OWNER"` sur SON PROPRE identifiant agent, `requireRole` faisant
 * confiance au rôle du cookie signé sans le revérifier en base. Corrigé
 * ici une fois pour toutes : un compte existant dont le rôle ne correspond
 * pas à la surface est traité comme non reconnu, jamais recyclé sous un
 * autre rôle.
 */

export type IdentifierKind = "phone" | "email";

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

/** Détecte si l'identifiant saisi est un téléphone ou un email, et le
 * normalise. `null` si le texte saisi ne correspond à aucun des deux
 * formats. */
export function classifyIdentifier(raw: string): { kind: IdentifierKind; value: string } | null {
  const trimmed = raw.trim();
  if (trimmed.includes("@")) {
    const parsed = z.string().trim().toLowerCase().email().safeParse(trimmed);
    return parsed.success ? { kind: "email", value: parsed.data } : null;
  }
  const parsed = phoneSchema.safeParse(trimmed);
  return parsed.success ? { kind: "phone", value: parsed.data.replace(/\s+/g, "") } : null;
}

export type LoginOptions = { role: UserRole; allowSelfSignup: boolean };

export type RequestOtpState = { status: "idle" | "sent" | "error"; message?: string };

export async function requestLoginOtp(
  formData: FormData,
  purpose: OtpPurpose,
  options: LoginOptions
): Promise<RequestOtpState> {
  const identifier = classifyIdentifier(String(formData.get("identifier") ?? ""));
  if (!identifier) {
    return { status: "error", message: "invalid_identifier" };
  }

  try {
    if (identifier.kind === "phone") {
      // Cherché même si l'auto-inscription est permise : un compte déjà
      // enregistré garde son email de secours d'une connexion à l'autre
      // (décision 0014), et surtout — voir la note d'en-tête — un compte
      // existant d'un AUTRE rôle ne doit jamais recevoir de code ici.
      const existingUser = await prisma.user.findUnique({ where: { phone: identifier.value } });
      if (existingUser && existingUser.role !== options.role) {
        return { status: "error", message: "not_recognized" };
      }
      if (!existingUser && !options.allowSelfSignup) {
        return { status: "error", message: "not_recognized" };
      }

      const parsedEmail = emailSchema.safeParse(formData.get("email"));
      if (!parsedEmail.success) {
        return { status: "error", message: "invalid_email" };
      }
      const email = existingUser?.email ?? parsedEmail.data;

      await requestOtp({ phone: identifier.value, purpose, email });
      return { status: "sent" };
    }

    // kind === "email" : jamais d'auto-inscription (voir en-tête), le
    // compte doit déjà exister avec ce rôle et cet email exact.
    const user = await prisma.user.findFirst({ where: { email: identifier.value, role: options.role } });
    if (!user) {
      // Même réponse qu'un identifiant inconnu : pas d'énumération de
      // comptes par email.
      return { status: "error", message: "not_recognized" };
    }
    await requestEmailOtp({ email: identifier.value, purpose, userId: user.id });
    return { status: "sent" };
  } catch (err) {
    if (err instanceof OtpRateLimitError) {
      return { status: "error", message: "rate_limited" };
    }
    throw err;
  }
}

export type VerifyOtpState = { status: "idle" | "error"; message?: string };

export async function verifyLoginOtp(
  formData: FormData,
  purpose: OtpPurpose,
  options: LoginOptions & { redirectHref: string }
): Promise<VerifyOtpState> {
  const identifier = classifyIdentifier(String(formData.get("identifier") ?? ""));
  if (!identifier) {
    return { status: "error", message: "invalid_identifier" };
  }
  const code = String(formData.get("code") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  // Simple validation ici : déjà vérifié (ou laissé vide) à l'étape de
  // demande du code — voir requestLoginOtp. Un email invalide à ce stade
  // est ignoré plutôt que bloquant, la connexion ne doit jamais dépendre
  // de ce champ optionnel.
  const secondaryEmail = emailSchema.safeParse(formData.get("email")).data || undefined;

  const result = await verifyOtp({ phone: identifier.value, purpose, code });
  if (!result.ok) {
    return { status: "error", message: result.reason };
  }

  let user = result.userId ? await prisma.user.findUnique({ where: { id: result.userId } }) : null;
  if (!user) {
    user =
      identifier.kind === "phone"
        ? await prisma.user.findUnique({ where: { phone: identifier.value } })
        : await prisma.user.findFirst({ where: { email: identifier.value, role: options.role } });
  }
  // Voir la note d'en-tête du module : un compte trouvé sous un autre rôle
  // n'est jamais réutilisé.
  if (user && user.role !== options.role) {
    user = null;
  }

  if (!user) {
    if (identifier.kind !== "phone" || !options.allowSelfSignup) {
      return { status: "error", message: "not_recognized" };
    }
    user = await prisma.user.create({
      data: {
        phone: identifier.value,
        role: options.role,
        fullName: fullName || identifier.value,
        email: secondaryEmail,
      },
    });
  }

  await createUserSession(user.id, options.role);
  return redirect({ href: options.redirectHref, locale: (formData.get("locale") as string) || "fr" });
}
