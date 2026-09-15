import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { getSmsProvider } from "@/lib/sms/provider";
import { getEmailProvider } from "@/lib/email/provider";
import type { $Enums } from "@/generated/prisma/client";

/**
 * Authentification téléphone + code à usage unique — partagée par les
 * quatre surfaces (CDC §3) : le voyageur (session éphémère, pas de compte),
 * le propriétaire, l'agent et l'administrateur (compte). C'est la seule
 * implémentation : ne pas dupliquer cette logique ailleurs dans le code.
 *
 * Le téléphone reste le canal obligatoire dans tous les cas — voir décision
 * 0014. Quand un email est connu (fourni au moment de la demande, ou déjà
 * enregistré sur le compte), le même code lui est envoyé EN PLUS, jamais à
 * sa place : un échec d'envoi d'email ne doit jamais empêcher la connexion
 * ou la réservation, qui restent entièrement portées par le SMS.
 */

export type OtpPurpose = $Enums.OtpPurpose;

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_VERIFY_ATTEMPTS = 5;
const MAX_REQUESTS_PER_WINDOW = 5;
const REQUEST_WINDOW_MS = 15 * 60 * 1000; // 15 minutes, anti-flood

export class OtpRateLimitError extends Error {
  constructor() {
    super("Trop de demandes de code pour ce numéro. Réessayez plus tard.");
    this.name = "OtpRateLimitError";
  }
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET manquant — voir .env.example");
  return secret;
}

function hashCode(phone: string, purpose: OtpPurpose, code: string): string {
  return createHmac("sha256", getSecret()).update(`${purpose}:${phone}:${code}`).digest("hex");
}

function generateCode(): string {
  // 6 chiffres, y compris les zéros en tête (pas de conversion en nombre).
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Démarre une demande de code. Envoie le SMS via le fournisseur configuré
 * (console en développement — voir src/lib/sms/provider.ts), et le même
 * code par email si `email` est fourni (canal de secours, décision 0014).
 * Lève OtpRateLimitError au-delà de 5 demandes en 15 minutes pour un même
 * numéro et un même usage (anti-énumération, anti-flood — voir plan S0-4).
 */
export async function requestOtp(params: {
  phone: string;
  purpose: OtpPurpose;
  userId?: string;
  email?: string;
}): Promise<void> {
  const { phone, purpose, userId, email } = params;

  const windowStart = new Date(Date.now() - REQUEST_WINDOW_MS);
  const recentCount = await prisma.otpCode.count({
    where: { phone, purpose, createdAt: { gte: windowStart } },
  });
  if (recentCount >= MAX_REQUESTS_PER_WINDOW) {
    throw new OtpRateLimitError();
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.otpCode.create({
    data: {
      phone,
      purpose,
      codeHash: hashCode(phone, purpose, code),
      expiresAt,
      userId,
    },
  });

  await getSmsProvider().send({
    to: phone,
    body: `Votre code Séjours est ${code}. Il expire dans 5 minutes.`,
  });

  if (email) {
    try {
      await getEmailProvider().send({
        to: email,
        subject: "Votre code Séjours",
        body: `Votre code Séjours est ${code}. Il expire dans 5 minutes.`,
      });
    } catch (err) {
      // Best-effort : le SMS ci-dessus a déjà été envoyé, c'est lui qui
      // garantit la connexion/réservation. Un email en échec ne doit
      // jamais faire échouer requestOtp — voir décision 0014.
      console.error(`[otp] échec de l'envoi du code de secours par email à ${email}`, err);
    }
  }
}

/** Envoie un OTP par email pour un compte déjà provisionné.
 * L'adresse est utilisée comme identifiant technique du code, mais n'est
 * jamais acceptée comme preuve d'un compte qui n'existe pas.
 */
export async function requestEmailOtp(params: {
  email: string;
  purpose: OtpPurpose;
  userId: string;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();
  const windowStart = new Date(Date.now() - REQUEST_WINDOW_MS);
  const recentCount = await prisma.otpCode.count({
    where: { phone: email, purpose: params.purpose, createdAt: { gte: windowStart } },
  });
  if (recentCount >= MAX_REQUESTS_PER_WINDOW) throw new OtpRateLimitError();

  const code = generateCode();
  await prisma.otpCode.create({
    data: {
      phone: email,
      purpose: params.purpose,
      userId: params.userId,
      codeHash: hashCode(email, params.purpose, code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  await getEmailProvider().send({
    to: email,
    subject: "Votre code de connexion administrateur",
    body: `Votre code Séjours est ${code}. Il expire dans 5 minutes.`,
  });
}

export type VerifyOtpResult =
  | { ok: true; otpCodeId: string; userId: string | null }
  | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "mismatch" };

/**
 * Vérifie le code le plus récent, non consommé, pour ce numéro et cet usage.
 * Chaque tentative (même ratée) est comptabilisée, jusqu'à 5 avant blocage
 * du code — il faut alors en redemander un.
 */
export async function verifyOtp(params: {
  phone: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<VerifyOtpResult> {
  const { phone, purpose, code } = params;

  const otp = await prisma.otpCode.findFirst({
    where: { phone, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return { ok: false, reason: "not_found" };
  if (otp.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  const candidate = Buffer.from(hashCode(phone, purpose, code));
  const stored = Buffer.from(otp.codeHash);
  const matches = candidate.length === stored.length && timingSafeEqual(candidate, stored);

  const consumed = await prisma.otpCode.updateMany({
    where: { id: otp.id, consumedAt: null, attempts: { lt: MAX_VERIFY_ATTEMPTS }, expiresAt: { gt: new Date() } },
    data: {
      attempts: { increment: 1 },
      consumedAt: matches ? new Date() : undefined,
    },
  });

  if (consumed.count !== 1) return { ok: false, reason: "not_found" };
  if (!matches) return { ok: false, reason: "mismatch" };
  return { ok: true, otpCodeId: otp.id, userId: otp.userId };
}
