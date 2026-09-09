import nodemailer, { type Transporter } from "nodemailer";

/**
 * Port d'envoi d'email, abstrait derrière une interface — même principe que
 * src/lib/sms/provider.ts. Canal de SECOURS optionnel pour l'OTP (décision
 * 0014) : le téléphone + SMS reste le canal obligatoire dans tous les cas
 * (CDC §3) ; l'email, quand l'utilisateur en fournit un, s'ajoute en plus,
 * il ne le remplace jamais.
 *
 * Fournisseur réel : SMTP générique (mis en service avec Migadu — voir
 * .env.example — mais SmtpEmailProvider ne dépend d'aucune spécificité
 * Migadu : n'importe quel hébergeur de boîte mail exposant du SMTP standard
 * convient, il suffit de changer SMTP_HOST/PORT). Migadu n'offre pas d'API
 * HTTP d'envoi transactionnel, seulement IMAP/SMTP classique avec le mot de
 * passe de la boîte — d'où ce choix plutôt qu'un client d'API dédié comme
 * pour un ESP (Postmark, SES…).
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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} manquant — voir .env.example`);
  return value;
}

/**
 * SMTP standard, sans dépendance à un ESP particulier. `secure: true` est
 * correct pour le port 465 (TLS implicite dès la connexion) — sur le port
 * 587 il faudrait `secure: false` et laisser STARTTLS négocier
 * (nodemailer s'en charge automatiquement), voir SMTP_PORT ci-dessous.
 */
class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;
  private from: string;

  constructor() {
    const port = Number(requireEnv("SMTP_PORT"));
    this.transporter = nodemailer.createTransport({
      host: requireEnv("SMTP_HOST"),
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth: {
        user: requireEnv("SMTP_USER"),
        pass: requireEnv("SMTP_PASSWORD"),
      },
    });
    this.from = process.env.EMAIL_FROM || requireEnv("SMTP_USER");
  }

  async send({ to, subject, body }: { to: string; subject: string; body: string }): Promise<void> {
    await this.transporter.sendMail({ from: this.from, to, subject, text: body });
  }
}

let provider: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;

  switch (process.env.EMAIL_PROVIDER) {
    case "console":
      provider = new ConsoleEmailProvider();
      break;
    case "smtp":
      provider = new SmtpEmailProvider();
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
