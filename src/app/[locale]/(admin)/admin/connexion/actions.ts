"use server";

import {
  requestLoginOtp,
  verifyLoginOtp,
  type LoginOptions,
  type RequestOtpState,
  type VerifyOtpState,
} from "@/lib/auth/login-flow";

/**
 * Connexion administrateur par téléphone OU email + OTP (CDC §3). Compte
 * provisionné par VD Technologies (voir prisma/seed.ts), pas
 * d'auto-inscription — même principe que l'agent.
 *
 * Jusqu'au 15/09, cette page portait deux formulaires distincts (un pour
 * le téléphone, un dédié à l'email — voir git history). Fondu dans le
 * flux unifié de src/lib/auth/login-flow.ts, qui gère les deux canaux
 * depuis un seul champ.
 */

const ADMIN_LOGIN_OPTIONS: LoginOptions = { role: "ADMIN", allowSelfSignup: false };

export async function requestAdminOtpAction(
  _prev: RequestOtpState,
  formData: FormData
): Promise<RequestOtpState> {
  return requestLoginOtp(formData, "ADMIN_LOGIN", ADMIN_LOGIN_OPTIONS);
}

export async function verifyAdminOtpAction(
  _prev: VerifyOtpState,
  formData: FormData
): Promise<VerifyOtpState> {
  return verifyLoginOtp(formData, "ADMIN_LOGIN", { ...ADMIN_LOGIN_OPTIONS, redirectHref: "/admin" });
}
