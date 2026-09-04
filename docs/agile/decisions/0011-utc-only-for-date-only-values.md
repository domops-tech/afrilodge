# 0011 — Toujours l'UTC pour une valeur « date seule », jamais l'heure locale du serveur

**Statut** : correctif appliqué lors de la revue manuelle au navigateur du
Sprint 5, avant le rapport de sprint. Concerne tout code qui manipule
`AvailabilityDay.date` (`@db.Date`, sans heure) — calendrier propriétaire,
tunnel de réservation, et tout code futur du même type (ex. futures règles
d'annulation par date).

## Le symptôme

Après qu'un voyageur ait réservé le Studio Cocody Angré du 15 au 17
octobre, le calendrier de disponibilité du propriétaire affichait les
cases **16 et 17** comme verrouillées (grisées, non décochables) — alors
que la base contenait bien les lignes `AvailabilityDay` attendues pour le
**15 et le 16** (vérifié directement en base). Décalage d'exactement un
jour, repéré uniquement par capture d'écran en revue manuelle : la suite
Playwright ne l'aurait pas vu, puisqu'elle ne compare jamais un jour
affiché à son intitulé visuel, seulement la base à elle-même.

## Cause

Le conteneur de développement tourne en CEST (UTC+2), pas en UTC. Trois
endroits calculaient un « aujourd'hui » ainsi :

```ts
const today = new Date();       // heure locale au moment de l'appel
today.setHours(0, 0, 0, 0);     // minuit LOCAL, pas minuit UTC
```

puis dérivaient une clé de comparaison avec `date.toISOString().slice(0,
10)` — une conversion **UTC**. Minuit local en CEST correspond à 22h la
veille en UTC : `.toISOString()` d'un « aujourd'hui » ainsi calculé rendait
donc la date d'**hier**. Le calendrier propriétaire itérait ensuite ce
point de départ avec `.setDate()` (encore local) pour construire sa grille
de jours, et lisait le numéro affiché avec `.getDate()` (encore local) — le
numéro de case restait juste, mais la clé utilisée pour interroger le
statut (`toIsoDate`) était décalée d'un jour, d'où la case affichée décalée
par rapport à la vraie donnée.

À l'inverse, les dates saisies dans le tunnel de réservation
(`checkIn`/`checkOut`, `z.coerce.date()` sur une chaîne `"2026-10-15"`
venant d'un `<input type="date">`) sont **sans ambiguïté analysées en UTC**
par le moteur JS (une chaîne ISO « date seule » est toujours interprétée en
UTC, contrairement à une chaîne avec heure). C'est pour ça que les lignes
`AvailabilityDay` posées à la confirmation de la réservation étaient
**correctes** en base : le bug n'était que dans la lecture/l'écriture côté
calendrier propriétaire, pas dans la pose du verrou elle-même.

## Décision

Ne jamais mélanger arithmétique de date **locale** (`setHours`, `setDate`,
`getDate`) et lecture/clé **UTC** (`toISOString()`, colonne `@db.Date`)
pour une valeur qui n'a pas d'heure. Deux fonctions utilitaires,
`startOfUtcDay()` et `addUtcDays()`, ajoutées à `src/lib/booking/nights.ts`
(déjà le point d'unicité pour `isoDate()` et `nightsInRange()`) :

```ts
export function startOfUtcDay(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
export function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
```

`nightsInRange()` elle-même est passée de `setDate`/`getDate` à
`setUTCDate`/`getUTCDate` — elle fonctionnait par coïncidence sous UTC+2
(un décalage positif ne pousse jamais minuit UTC vers la veille en heure
locale), mais aurait reproduit le même bug sous un décalage négatif
(Amériques). Appliqué aux trois points qui construisaient un « aujourd'hui »
local : `reserver/[propertyId]/page.tsx`, `proprietaire/biens/[propertyId]
/page.tsx` (rendu de la grille, y compris le numéro de jour affiché — passé
à `getUTCDate()`) et `.../actions.ts` (`updateAvailabilityAction`, qui
aurait sinon bloqué le mauvais jour à l'enregistrement du calendrier).

## Quand appliquer ce correctif

Dès qu'un nouveau code construit un point de départ « aujourd'hui » ou
manipule une date sans heure destinée à être comparée à une colonne
`@db.Date` ou à une clé `toISOString().slice(0, 10)` : utiliser
`startOfUtcDay()` / `addUtcDays()` / `isoDate()` de
`src/lib/booking/nights.ts`, jamais `new Date()` + `setHours` + `setDate`
locaux. Un `DateTime` complet (horodatage réel : `Visit.completedAt`,
`Verification.expiresAt`…) n'est pas concerné — cette classe de bug ne
touche que les valeurs « date seule ».
