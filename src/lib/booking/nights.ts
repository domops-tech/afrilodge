/**
 * Nuits couvertes par un séjour [checkIn, checkOut) — une réservation d'une
 * nuit ne couvre qu'un seul jour (CDC §7.3, même convention que
 * AvailabilityDay). Pur et sans dépendance serveur : utilisé à la fois côté
 * client (retour immédiat sur une sélection de dates indisponible, épic
 * 5.1) et côté serveur (verrouillage du calendrier, épic 5.2) — voir
 * src/lib/booking/availability.ts pour la variante qui interroge la base.
 *
 * Toujours en UTC (`getUTCDate`/`setUTCDate`, jamais les variantes locales) :
 * une date de séjour n'a pas d'heure, et `AvailabilityDay.date` (`@db.Date`)
 * est comparée par sa représentation ISO/UTC. Mélanger arithmétique locale
 * et lecture UTC décale silencieusement le calendrier d'un jour dès que le
 * serveur ne tourne pas en UTC (repéré en revue manuelle du Sprint 5 sur un
 * hôte en CEST : le calendrier propriétaire affichait les jours verrouillés
 * décalés d'un jour).
 */
export function nightsInRange(checkIn: Date, checkOut: Date): Date[] {
  const nights: Date[] = [];
  const cursor = new Date(checkIn);
  while (cursor < checkOut) {
    nights.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return nights;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Minuit UTC du jour courant (ou d'une date donnée) — jamais `setHours` (local). */
export function startOfUtcDay(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Ajoute des jours en UTC — jamais `setDate` (local), pour la même raison que nightsInRange. */
export function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
