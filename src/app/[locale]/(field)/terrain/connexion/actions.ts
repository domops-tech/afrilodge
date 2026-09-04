"use server";

import {
  requestLoginOtp,
  verifyLoginOtp,
  type RequestOtpState,
  type VerifyOtpState,
} from "@/lib/auth/login-flow";

/**
 * Connexion agent (CDC §3). À la différence du propriétaire, le compte est
 * provisionné par VD Technologies (voir prisma/seed.ts) : un numéro non
 * reconnu comme agent n'est ni créé, ni même envoyé de code — voir
 * `requireExistingRole`/`allowSelfSignup: false`.
 */

export async function requestAgentOtpAction(
  _prev: RequestOtpState,
  formData: FormData
): Promise<RequestOtpState> {
  return requestLoginOtp(formData, "AGENT_LOGIN", { requireExistingRole: "AGENT" });
}

export async function verifyAgentOtpAction(
  _prev: VerifyOtpState,
  formData: FormData
): Promise<VerifyOtpState> {
  return verifyLoginOtp(formData, "AGENT_LOGIN", {
    role: "AGENT",
    allowSelfSignup: false,
    redirectHref: "/terrain",
  });
}
