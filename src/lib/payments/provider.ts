/**
 * Port de paiement (CDC §8, §12). Aucun fonds ne transite par VD
 * Technologies : cette interface ne fait que refléter l'état déclaré par
 * l'établissement de paiement agréé BCEAO, jamais détenir les fonds
 * elle-même. Le PSP réel n'est pas choisi ; brancher un adaptateur réel se
 * fait en implémentant cette seule interface, sans toucher aux appelants
 * (voir docs/agile/decisions/0002-payment-abstraction.md).
 */

export type PaymentIntentRef = string;

export interface CreateIntentParams {
  bookingId: string;
  amount: number; // francs CFA
  payerPhone: string;
}

export interface CreateIntentResult {
  providerIntentRef: PaymentIntentRef;
}

export type ProviderPaymentStatus = "pending" | "held" | "released" | "refunded" | "failed";

export interface PaymentProvider {
  readonly name: string;

  /** Crée une intention de paiement à l'acceptation de la réservation (CDC §8.1). */
  createIntent(params: CreateIntentParams): Promise<CreateIntentResult>;

  /** Interroge l'état courant auprès du PSP (utilisé en secours du webhook). */
  getStatus(providerIntentRef: PaymentIntentRef): Promise<ProviderPaymentStatus>;

  /** Ordre de libération des fonds, émis après confirmation d'arrivée (CDC §8.6). */
  release(providerIntentRef: PaymentIntentRef): Promise<void>;

  /** Remboursement selon les conditions transmises (CDC §8.7). */
  refund(providerIntentRef: PaymentIntentRef, reason: string): Promise<void>;

  /**
   * Vérifie l'authenticité d'un webhook entrant avant tout traitement.
   * L'état d'un Payment ne doit jamais suivre l'appel sortant, uniquement
   * un webhook vérifié (voir plan — Architecture cible).
   */
  verifyWebhook(rawBody: string, signatureHeader: string | null): boolean;
}
