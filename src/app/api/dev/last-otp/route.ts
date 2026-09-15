import { NextRequest, NextResponse } from "next/server";
import { __getLastConsoleMessage } from "@/lib/sms/provider";
import { __getLastConsoleEmail } from "@/lib/email/provider";

/**
 * Route strictement réservée au développement et aux tests de bout en bout
 * (Playwright, voir e2e/auth.spec.ts) : récupère le dernier code envoyé
 * pour un identifiant donné — numéro de téléphone (fournisseur SMS
 * console) ou email (fournisseur email console) — pour éviter de dépendre
 * d'un vrai opérateur avant que le §12 du CDC ne soit tranché.
 *
 * Le paramètre reste nommé `phone` (compatibilité avec tous les appels e2e
 * existants, antérieurs à la connexion par email — voir
 * src/lib/auth/login-flow.ts) mais accepte en réalité n'importe quel
 * identifiant : SMS et email sont cherchés dans cet ordre, sans ambiguïté
 * possible puisqu'un numéro de téléphone ne contient jamais "@".
 *
 * Gardée par SMS_PROVIDER=console plutôt que par NODE_ENV : les tests de
 * bout en bout tournent contre un build de production (`next start`), où
 * NODE_ENV vaut déjà "production" ; c'est le choix du fournisseur SMS qui
 * doit rester impossible en exploitation réelle (voir .env.example),
 * jamais l'environnement d'exécution du serveur.
 */
export async function GET(request: NextRequest) {
  if (process.env.SMS_PROVIDER !== "console") {
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
