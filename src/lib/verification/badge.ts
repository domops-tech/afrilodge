/**
 * Calcul de validité de la mention « Vérifié » (CDC §4.2). Source unique :
 * aucun autre endroit du code ne doit recalculer l'expiration ou la
 * validité d'une vérification.
 */

export const VERIFICATION_VALIDITY_DAYS = 365;

export function computeExpiresAt(visitDate: Date): Date {
  const expires = new Date(visitDate);
  expires.setDate(expires.getDate() + VERIFICATION_VALIDITY_DAYS);
  return expires;
}

export type VerificationLike = {
  status: "ACTIVE" | "EXPIRED" | "WITHDRAWN";
  expiresAt: Date;
};

/**
 * Une mention n'est affichable au voyageur que si elle est ACTIVE en base
 * ET non expirée à l'instant présent — la colonne `status` est mise à jour
 * par une tâche planifiée (back-office, CDC §6.5), mais on ne fait jamais
 * confiance à elle seule pour l'affichage : l'horloge tranche.
 */
export function isVerificationValid(verification: VerificationLike, now = new Date()): boolean {
  return verification.status === "ACTIVE" && verification.expiresAt.getTime() > now.getTime();
}
