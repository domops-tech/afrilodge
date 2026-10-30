import { NextRequest, NextResponse } from "next/server";
import { __getLastConsoleMessage } from "@/lib/sms/provider";
import { __getLastConsoleEmail } from "@/lib/email/provider";

/**
 * Route réservée aux tests de bout en bout (Playwright, voir e2e/auth.spec.ts) :
 * renvoie le dernier code envoyé à un numéro ou à un email par les
 * fournisseurs « console », pour ne pas dépendre d'un vrai opérateur.
 *
 * Elle exige DEUX conditions : SMS_PROVIDER=console ET
 * ENABLE_DEV_OTP_ENDPOINT=1. Le second indicateur n'est posé que par
 * playwright.config.ts (les tests tournent contre un build de production,
 * donc NODE_ENV ne peut pas servir de garde) ; il ne doit jamais figurer
 * dans l'environnement d'un serveur exposé, sans quoi n'importe qui peut lire
 * le code de connexion d'un compte dont il connaît le numéro.
 *
 * Le paramètre reste nommé `phone` (compatibilité avec les appels e2e) mais
 * accepte aussi un email : SMS puis email sont cherchés dans cet ordre.
 */
export async function GET(request: NextRequest) {
  if (process.env.SMS_PROVIDER !== "console" || process.env.ENABLE_DEV_OTP_ENDPOINT !== "1") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const identifier = request.nextUrl.searchParams.get("phone");
  if (!identifier) {
    return NextResponse.json({ error: "phone_required" }, { status: 400 });
  }

  const message = __getLastConsoleMessage(identifier) ?? __getLastConsoleEmail(identifier);
  const code = message?.match(/\b(\d{6})\b/)?.[1];

  return NextResponse.json({ code: code ?? null });
}
