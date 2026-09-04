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
 */

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{8,15}$/, "Numéro de téléphone invalide");

export type RequestOtpState = { status: "idle" | "sent" | "error"; message?: string };

export async function requestLoginOtp(
  formData: FormData,
  purpose: OtpPurpose,
  options?: { requireExistingRole?: UserRole }
): Promise<RequestOtpState> {
  const parsed = phoneSchema.safeParse(formData.get("phone"));
  if (!parsed.success) {
    return { status: "error", message: "invalid_phone" };
  }
  const phone = parsed.data.replace(/\s+/g, "");

  if (options?.requireExistingRole) {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || user.role !== options.requireExistingRole) {
      return { status: "error", message: "not_recognized" };
    }
  }

  try {
    await requestOtp({ phone, purpose });
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
      data: { phone, role: options.role, fullName: fullName || phone },
    });
  }

  await createUserSession(user.id, options.role);
  return redirect({ href: options.redirectHref, locale: (formData.get("locale") as string) || "fr" });
}
