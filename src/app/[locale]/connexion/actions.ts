"use server";

import {
  requestLoginOtp,
  verifyLoginOtp,
  type RequestOtpState,
  type VerifyOtpState,
} from "@/lib/auth/login-flow";

/**
 * Connexion propriétaire par téléphone + OTP (CDC §3, §5.2.16 : "il crée
 * son compte et sollicite la vérification de son bien"). Voir
 * src/app/[locale]/(field)/terrain/connexion/actions.ts pour l'équivalent
 * agent, qui réutilise les mêmes fonctions avec `purpose`/`role` différents.
 */

export async function requestOwnerOtpAction(
  _prev: RequestOtpState,
  formData: FormData
): Promise<RequestOtpState> {
  return requestLoginOtp(formData, "OWNER_LOGIN");
}

export async function verifyOwnerOtpAction(
  _prev: VerifyOtpState,
  formData: FormData
): Promise<VerifyOtpState> {
  return verifyLoginOtp(formData, "OWNER_LOGIN", {
    role: "OWNER",
    allowSelfSignup: true,
    redirectHref: "/proprietaire",
  });
}
