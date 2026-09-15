"use server";

import {
  requestLoginOtp,
  verifyLoginOtp,
  type LoginOptions,
  type RequestOtpState,
  type VerifyOtpState,
} from "@/lib/auth/login-flow";

/**
 * Connexion agent par téléphone OU email + OTP (CDC §3). À la différence
 * du propriétaire, le compte est provisionné par VD Technologies (voir
 * `/admin/agents` ou prisma/seed.ts) : un identifiant non reconnu comme
 * agent n'est ni créé, ni même envoyé de code (allowSelfSignup: false).
 */

const AGENT_LOGIN_OPTIONS: LoginOptions = { role: "AGENT", allowSelfSignup: false };

export async function requestAgentOtpAction(
  _prev: RequestOtpState,
  formData: FormData
): Promise<RequestOtpState> {
  return requestLoginOtp(formData, "AGENT_LOGIN", AGENT_LOGIN_OPTIONS);
}

export async function verifyAgentOtpAction(
  _prev: VerifyOtpState,
  formData: FormData
): Promise<VerifyOtpState> {
  return verifyLoginOtp(formData, "AGENT_LOGIN", { ...AGENT_LOGIN_OPTIONS, redirectHref: "/terrain" });
}
