"use server";

import {
  requestLoginOtp,
  verifyLoginOtp,
  type RequestOtpState,
  type VerifyOtpState,
} from "@/lib/auth/login-flow";

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
