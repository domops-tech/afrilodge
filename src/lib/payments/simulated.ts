import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  CreateIntentParams,
  CreateIntentResult,
  PaymentProvider,
  ProviderPaymentStatus,
} from "@/lib/payments/provider";

/**
 * Simulateur Mobile Money — tient lieu de PSP réel tant que le §12 du CDC
 * n'est pas tranché (établissement agréé BCEAO). Reproduit le contrat
 * complet du port `PaymentProvider` : intention, conservation, libération,
 * remboursement, webhooks signés et idempotents. Brancher le PSP réel plus
 * tard consiste à écrire un second fichier qui implémente la même
 * interface — aucun appelant ne change.
 *
 * État conservé en mémoire du process, sur `globalThis` plutôt que sur une
 * variable de module : Next.js compile les Server Actions (création
 * d'intention) et les Route Handlers (réception du webhook) en bundles
 * distincts, chacun avec sa propre instance de module — voir le même
 * correctif sur src/lib/sms/provider.ts pour le détail. Suffisant pour un
 * simulateur de développement, pas pour une exécution multi-instance. À
 * remplacer par l'état réel du PSP au moment de l'intégration (CDC §12).
 */
const globalForPayments = globalThis as unknown as {
  simulatedPaymentState: Map<string, ProviderPaymentStatus> | undefined;
};
const sharedState =
  globalForPayments.simulatedPaymentState ?? new Map<string, ProviderPaymentStatus>();
globalForPayments.simulatedPaymentState = sharedState;

class SimulatedMobileMoneyProvider implements PaymentProvider {
  readonly name = "simulated";
  private state = sharedState;

  async createIntent(params: CreateIntentParams): Promise<CreateIntentResult> {
    const providerIntentRef = `sim_${randomUUID()}`;
    this.state.set(providerIntentRef, "pending");
    console.log(
      `[PaymentSimulator] intention créée pour la réservation ${params.bookingId} : ${providerIntentRef} (${params.amount} FCFA)`
    );
    return { providerIntentRef };
  }

  async getStatus(providerIntentRef: string): Promise<ProviderPaymentStatus> {
    return this.state.get(providerIntentRef) ?? "failed";
  }

  /**
   * Simule le voyageur qui complète le paiement sur ses propres canaux
   * Mobile Money. Réservé au développement et aux tests — le PSP réel
   * appellera notre webhook de son propre côté.
   */
  simulatePayerCompletion(providerIntentRef: string): void {
    if (this.state.get(providerIntentRef) === "pending") {
      this.state.set(providerIntentRef, "held");
    }
  }

  async release(providerIntentRef: string): Promise<void> {
    if (this.state.get(providerIntentRef) !== "held") {
      throw new Error(`Impossible de libérer des fonds non conservés : ${providerIntentRef}`);
    }
    this.state.set(providerIntentRef, "released");
  }

  async refund(providerIntentRef: string): Promise<void> {
    this.state.set(providerIntentRef, "refunded");
  }

  buildWebhookSignature(rawBody: string): string {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? "";
    return createHmac("sha256", secret).update(rawBody).digest("hex");
  }

  verifyWebhook(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;
    const expected = Buffer.from(this.buildWebhookSignature(rawBody));
    const actual = Buffer.from(signatureHeader);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}

let provider: PaymentProvider | undefined;

export function getPaymentProvider(): PaymentProvider {
  if (provider) return provider;

  switch (process.env.PAYMENT_PROVIDER) {
    case "simulated":
    default:
      provider = new SimulatedMobileMoneyProvider();
  }

  return provider;
}

function asSimulator(activeProvider: PaymentProvider): SimulatedMobileMoneyProvider {
  if (!(activeProvider instanceof SimulatedMobileMoneyProvider)) {
    throw new Error("Cette fonction requiert le simulateur de paiement.");
  }
  return activeProvider;
}

/**
 * Simule le voyageur qui complète le paiement sur ses propres canaux
 * Mobile Money — réservé au développement et aux tests, voir
 * `SimulatedMobileMoneyProvider.simulatePayerCompletion`. Absent de
 * l'interface `PaymentProvider` pour la même raison que
 * `buildSimulatedWebhookRequest` ci-dessous : un PSP réel n'a besoin
 * d'aucun appelant pour ça, c'est le voyageur qui interagit avec lui
 * directement.
 */
export function simulateGuestPayment(providerIntentRef: string): void {
  asSimulator(getPaymentProvider()).simulatePayerCompletion(providerIntentRef);
}

export type SimulatedWebhookEventType = "funds.held" | "funds.released" | "funds.refunded";

/**
 * Construit un webhook signé comme le ferait le PSP réel, pour que le
 * simulateur emprunte le même chemin vérifié + idempotent que la
 * production (voir src/lib/payments/webhook-handler.ts) plutôt que de
 * modifier l'état d'un paiement directement. Réservé au développement : un
 * vrai PSP signe ses propres webhooks, l'interface `PaymentProvider` ne
 * porte donc volontairement pas cette méthode — elle fuirait une
 * préoccupation propre au simulateur dans le port abstrait.
 */
export function buildSimulatedWebhookRequest(params: {
  type: SimulatedWebhookEventType;
  providerIntentRef: string;
}): { rawBody: string; signature: string } {
  const activeProvider = asSimulator(getPaymentProvider());
  const rawBody = JSON.stringify({
    type: params.type,
    externalId: randomUUID(),
    providerIntentRef: params.providerIntentRef,
  });
  return { rawBody, signature: activeProvider.buildWebhookSignature(rawBody) };
}
