import { NextRequest, NextResponse } from "next/server";
import { __getLastConsoleMessage } from "@/lib/sms/provider";

/**
 * Route strictement réservée au développement et aux tests de bout en bout
 * (Playwright, voir e2e/auth.spec.ts) : récupère le dernier code envoyé par
 * le simulateur SMS console pour un numéro donné, pour éviter de dépendre
 * d'un vrai opérateur SMS avant que le §12 du CDC ne soit tranché.
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

  const phone = request.nextUrl.searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ error: "phone_required" }, { status: 400 });
  }

  const message = __getLastConsoleMessage(phone);
  const code = message?.match(/\b(\d{6})\b/)?.[1];

  return NextResponse.json({ code: code ?? null });
}
