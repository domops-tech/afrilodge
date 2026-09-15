import { ZodError } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { processPaymentWebhook, WebhookVerificationError } from "@/lib/payments/webhook-handler";

/**
 * Point d'entrée réel du webhook de paiement (CDC §8.4) — ce qu'un PSP
 * appellerait en production. Signature vérifiée avant tout traitement,
 * jamais de confiance dans l'appel HTTP seul. Corps brut lu tel quel (pas
 * `request.json()`) : la vérification de signature porte sur les octets
 * exacts envoyés par le PSP, une désérialisation puis re-sérialisation
 * pourrait les altérer.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");

  try {
    const result = await processPaymentWebhook(rawBody, signature);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }
    if (err instanceof SyntaxError || err instanceof ZodError) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    throw err;
  }
}
