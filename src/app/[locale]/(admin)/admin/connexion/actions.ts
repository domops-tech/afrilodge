"use server";

import {
  requestLoginOtp,
  verifyLoginOtp,
  type RequestOtpState,
  type VerifyOtpState,
} from "@/lib/auth/login-flow";
import { prisma } from "@/lib/db/client";
import { emailSchema } from "@/lib/auth/login-flow";
import { requestEmailOtp, verifyOtp, OtpRateLimitError } from "@/lib/auth/otp";
import { createUserSession } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";

/**
 * Connexion administrateur (CDC §3). Compte provisionné par VD
 * Technologies (voir prisma/seed.ts), pas d'auto-inscription — même
 * principe que l'agent (src/app/[locale]/(field)/terrain/connexion/actions.ts).
 */

export async function requestAdminOtpAction(
  _prev: RequestOtpState,
  formData: FormData
): Promise<RequestOtpState> {
  return requestLoginOtp(formData, "ADMIN_LOGIN", { requireExistingRole: "ADMIN" });
}

export async function verifyAdminOtpAction(
  _prev: VerifyOtpState,
  formData: FormData
): Promise<VerifyOtpState> {
  return verifyLoginOtp(formData, "ADMIN_LOGIN", {
    role: "ADMIN",
    allowSelfSignup: false,
    redirectHref: "/admin",
  });
}

export type EmailOtpState = { status: "idle" | "sent" | "error"; email?: string; message?: string };

export async function requestAdminEmailOtpAction(
  _prev: EmailOtpState,
  formData: FormData
): Promise<EmailOtpState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  const email = parsed.success ? parsed.data : undefined;
  if (!email) return { status: "error", message: "invalid_email" };
  const user = await prisma.user.findFirst({ where: { email, role: "ADMIN" } });
  // Same response for an unknown address, avoiding account enumeration.
  if (!user) return { status: "error", message: "not_recognized" };
  try {
    await requestEmailOtp({ email, purpose: "ADMIN_EMAIL_LOGIN", userId: user.id });
  } catch (error) {
    if (error instanceof OtpRateLimitError) return { status: "error", message: "rate_limited" };
    throw error;
  }
  return { status: "sent", email };
}

export async function verifyAdminEmailOtpAction(
  _prev: EmailOtpState,
  formData: FormData
): Promise<EmailOtpState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  const email = parsed.success ? parsed.data : undefined;
  if (!email) return { status: "error", message: "invalid_email" };
  const result = await verifyOtp({
    phone: email,
    purpose: "ADMIN_EMAIL_LOGIN",
    code: String(formData.get("code") ?? "").trim(),
  });
  if (!result.ok) return { status: "error", message: result.reason };
  const user = await prisma.user.findFirst({ where: { email, role: "ADMIN" } });
  if (!user || result.userId !== user.id) return { status: "error", message: "not_recognized" };
  await createUserSession(user.id, "ADMIN");
  return redirect({ href: "/admin", locale: (formData.get("locale") as string) || "fr" });
}
