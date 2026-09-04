/**
 * Durée du verrou de calendrier posé à la demande de réservation (CDC
 * §7.3, épic 5.2) : passé ce délai sans paiement, la demande est annulée et
 * les jours redeviennent OPEN — voir scripts/expire-booking-holds.ts. Le
 * paiement lui-même arrive au Sprint 6 ; ce Sprint pose le verrou et son
 * expiration, qui s'appliquent déjà aux étapes Demandée et Acceptée.
 */
export const BOOKING_HOLD_DURATION_MS = 24 * 60 * 60 * 1000;
