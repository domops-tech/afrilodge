/**
 * Port d'envoi de SMS, abstrait derrière une interface — voir
 * src/lib/payments/provider.ts pour le même principe côté paiement.
 * L'opérateur SMS réel (Twilio, Orange, un agrégateur local…) n'est pas
 * choisi ; brancher un nouvel adaptateur ne touche jamais les appelants.
 */
export interface SmsProvider {
  send(params: { to: string; body: string }): Promise<void>;
}

// Dernier message envoyé par numéro, gardé en mémoire pour les tests de
// bout en bout (voir src/app/api/dev/last-otp/route.ts). Le code n'est
// jamais stocké en base, même en développement — voir src/lib/auth/otp.ts
// qui ne conserve que son empreinte HMAC.
//
// Sur `globalThis`, pas sur une variable de module : Next.js compile les
// Server Actions et les Route Handlers en bundles distincts, chacun avec sa
// propre instance du module — une variable de module ne serait donc pas
// partagée entre l'action de connexion et cette route de secours, alors que
// `globalThis` reste unique pour tout le process Node (même principe que le
// singleton Prisma, voir src/lib/db/client.ts).
const globalForSms = globalThis as unknown as {
  lastSmsByRecipient: Map<string, string> | undefined;
};
const lastMessageByRecipient = globalForSms.lastSmsByRecipient ?? new Map<string, string>();
globalForSms.lastSmsByRecipient = lastMessageByRecipient;

class ConsoleSmsProvider implements SmsProvider {
  async send({ to, body }: { to: string; body: string }): Promise<void> {
    lastMessageByRecipient.set(to, body);
    console.log(`[SMS→${to}] ${body}`);
  }
}

/** Réservé aux tests de bout en bout en développement — voir la route ci-dessus. */
export function __getLastConsoleMessage(phone: string): string | undefined {
  return lastMessageByRecipient.get(phone);
}

let provider: SmsProvider | undefined;

export function getSmsProvider(): SmsProvider {
  if (provider) return provider;

  switch (process.env.SMS_PROVIDER) {
    case "console":
    default:
      provider = new ConsoleSmsProvider();
  }

  return provider;
}
