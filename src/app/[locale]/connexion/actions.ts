"use server";

import {
  requestLoginOtp,
  verifyLoginOtp,
  type LoginOptions,
  type RequestOtpState,
  type VerifyOtpState,
} from "@/lib/auth/login-flow";

/**
 * Connexion propriétaire par téléphone OU email + OTP (CDC §3, §5.2.16 :
 * "il crée son compte et sollicite la vérification de son bien"). Voir
 * src/app/[locale]/(field)/terrain/connexion/actions.ts pour l'équivalent
 * agent, qui réutilise les mêmes fonctions avec `purpose`/`role`
 * différents. Seul le téléphone peut créer un compte (allowSelfSignup) —
 * jamais l'email, voir src/lib/auth/login-flow.ts.
 */

const OWNER_LOGIN_OPTIONS: LoginOptions = { role: "OWNER", allowSelfSignup: true };

export async function requestOwnerOtpAction(
  _prev: RequestOtpState,
  formData: FormData
): Promise<RequestOtpState> {
  return requestLoginOtp(formData, "OWNER_LOGIN", OWNER_LOGIN_OPTIONS);
}

export async function verifyOwnerOtpAction(
  _prev: VerifyOtpState,
  formData: FormData
): Promise<VerifyOtpState> {
  return verifyLoginOtp(formData, "OWNER_LOGIN", { ...OWNER_LOGIN_OPTIONS, redirectHref: "/proprietaire" });
}
