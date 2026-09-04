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

/** Écoulée dans le temps, indépendamment de la colonne `status` en base — voir scripts/expire-verifications.ts. */
export function isExpiredByClock(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export const RENEWAL_REMINDER_WINDOW_DAYS = 30;

export type RenewalReminderCandidate = {
  status: "ACTIVE" | "EXPIRED" | "WITHDRAWN";
  expiresAt: Date;
  renewalReminderSentAt: Date | null;
};

/**
 * Une mention active qui expire dans moins de 30 jours et n'a pas encore
 * été relancée (CDC §6.5.2). N'inclut pas les mentions déjà expirées : la
 * relance de renouvellement n'a de sens qu'avant l'échéance.
 */
export function needsRenewalReminder(
  verification: RenewalReminderCandidate,
  now = new Date()
): boolean {
  if (verification.status !== "ACTIVE") return false;
  if (verification.renewalReminderSentAt) return false;
  if (isExpiredByClock(verification.expiresAt, now)) return false;

  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + RENEWAL_REMINDER_WINDOW_DAYS);
  return verification.expiresAt.getTime() <= windowEnd.getTime();
}

/** Une fiche visitée il y a plus de 24h et toujours en attente de traitement (CDC §11.2). */
export function isReviewOverdue(visitCompletedAt: Date, now = new Date()): boolean {
  const hoursSince = (now.getTime() - visitCompletedAt.getTime()) / (1000 * 60 * 60);
  return hoursSince > 24;
}
