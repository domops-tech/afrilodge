"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requestOtp, verifyOtp, OtpRateLimitError } from "@/lib/auth/otp";
import { createUserSession } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";

/**
 * Connexion propriétaire par téléphone + OTP (CDC §3, §5.2.16 : "il crée
 * son compte et sollicite la vérification de son bien"). Les surfaces
 * agent (S1) et admin (S2) réutiliseront exactement `requestOtp`/`verifyOtp`
 * avec un `purpose` différent — ne pas dupliquer cette logique là-bas.
 */

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{8,15}$/, "Numéro de téléphone invalide");

export type RequestOtpState = { status: "idle" | "sent" | "error"; message?: string };

export async function requestOwnerOtpAction(
  _prev: RequestOtpState,
  formData: FormData
): Promise<RequestOtpState> {
  const parsed = phoneSchema.safeParse(formData.get("phone"));
  if (!parsed.success) {
    return { status: "error", message: "invalid_phone" };
  }
  const phone = parsed.data.replace(/\s+/g, "");

  try {
    await requestOtp({ phone, purpose: "OWNER_LOGIN" });
  } catch (err) {
    if (err instanceof OtpRateLimitError) {
      return { status: "error", message: "rate_limited" };
    }
    throw err;
  }

  return { status: "sent" };
}

export type VerifyOtpState = { status: "idle" | "error"; message?: string };

export async function verifyOwnerOtpAction(
  _prev: VerifyOtpState,
  formData: FormData
): Promise<VerifyOtpState> {
  const phone = String(formData.get("phone") ?? "").replace(/\s+/g, "");
  const code = String(formData.get("code") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();

  const result = await verifyOtp({ phone, purpose: "OWNER_LOGIN", code });

  if (!result.ok) {
    return { status: "error", message: result.reason };
  }

  // Première connexion : crée le compte propriétaire (CDC §5.2.16).
  const user =
    (result.userId && (await prisma.user.findUnique({ where: { id: result.userId } }))) ||
    (await prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone, role: "OWNER", fullName: fullName || phone },
    }));

  await createUserSession(user.id, "OWNER");
  return redirect({ href: "/proprietaire", locale: (formData.get("locale") as string) || "fr" });
}
