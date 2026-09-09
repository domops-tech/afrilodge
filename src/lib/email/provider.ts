/**
 * Port d'envoi d'email, abstrait derrière une interface — même principe que
 * src/lib/sms/provider.ts. Canal de SECOURS optionnel pour l'OTP (décision
 * 0014) : le téléphone + SMS reste le canal obligatoire dans tous les cas
 * (CDC §3) ; l'email, quand l'utilisateur en fournit un, s'ajoute en plus,
 * il ne le remplace jamais. Aucun fournisseur réel n'est choisi ici, comme
 * pour le SMS (décision 0013) — seul le simulateur console existe.
 */
export interface EmailProvider {
  send(params: { to: string; subject: string; body: string }): Promise<void>;
}

// Même raison qu'en SMS (voir provider.ts) : sur globalThis, pas sur une
// variable de module, pour rester visible entre Server Actions et Route
// Handlers malgré leurs bundles Next.js distincts.
const globalForEmail = globalThis as unknown as {
  lastEmailByRecipient: Map<string, string> | undefined;
};
const lastMessageByRecipient = globalForEmail.lastEmailByRecipient ?? new Map<string, string>();
globalForEmail.lastEmailByRecipient = lastMessageByRecipient;

class ConsoleEmailProvider implements EmailProvider {
  async send({ to, subject, body }: { to: string; subject: string; body: string }): Promise<void> {
    lastMessageByRecipient.set(to, body);
    console.log(`[EMAIL→${to}] ${subject}\n${body}`);
  }
}

/** Réservé aux tests de bout en bout en développement, même principe que
 * __getLastConsoleMessage côté SMS. */
export function __getLastConsoleEmail(address: string): string | undefined {
  return lastMessageByRecipient.get(address);
}

let provider: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;

  switch (process.env.EMAIL_PROVIDER) {
    case "console":
      provider = new ConsoleEmailProvider();
      break;
    default:
      // Même correction que src/lib/sms/provider.ts (voir décision 0013,
      // note technique) : pas de repli silencieux, sinon une valeur
      // absente ou mal orthographiée de EMAIL_PROVIDER ferait disparaître
      // les emails de secours sans que personne ne le remarque — moins
      // grave que côté SMS puisque ce canal n'est jamais le seul, mais pas
      // une raison d'introduire la même faille deux fois.
      throw new Error(
        `EMAIL_PROVIDER="${process.env.EMAIL_PROVIDER ?? ""}" inconnu — voir .env.example`
      );
  }

  return provider;
}
