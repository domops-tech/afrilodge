# Sprint 5 — Réservation

**Objectif** : réservation bout en bout jusqu'à « Acceptée », verrou de
calendrier tenu.

## Livré

Toutes les stories de l'épic 5 :

- **Sélection de dates avec disponibilité temps réel** (CDC §6.2.1,
  `/reserver/[propertyId]`) : dates et nombre de voyageurs, contrôlés
  côté client pour un retour immédiat (fenêtre de disponibilité chargée à
  l'ouverture de la page) puis **revérifiés côté serveur à chaque étape**
  du tunnel — jamais fait confiance au seul contrôle client, un autre
  voyageur peut réserver les mêmes dates entre deux étapes.
- **Verrouillage du calendrier à la demande** (CDC §7.3) : la confirmation
  pose des lignes `AvailabilityDay` en `HELD` dans la même transaction que
  la création de la réservation, avec `holdExpiresAt` à 24h. Le verrou
  reste tenu à l'acceptation (`ACCEPTED`) — il ne deviendra `BOOKED` qu'au
  paiement, Sprint 6. Expiration posée dès ce sprint :
  `scripts/expire-booking-holds.ts` (`npm run bookings:expire-holds`),
  même principe que `expire-verifications.ts` (décision 0005) — annule la
  demande et libère le calendrier si le paiement n'intervient pas à temps.
- **Identification du voyageur par OTP, sans compte** (CDC §6.2.2) :
  nouvel usage `GUEST_BOOKING` de l'infrastructure OTP partagée (déjà
  prévu au schéma depuis le Sprint 0), `GuestSession` créée à la
  confirmation, session éphémère de 6h (déjà prévue dans
  `src/lib/auth/session.ts`, jusqu'ici inutilisée).
- **Acceptation / refus par le propriétaire** : section « Réservations »
  de l'espace de gestion (jusqu'ici vide, plomberie posée au Sprint 4) —
  boutons Accepter/Refuser sur toute demande `REQUESTED`, via
  `transitionBooking` (machine à états du Sprint 0). Le refus libère
  immédiatement le calendrier, sans attendre l'expiration du verrou.
- **Écran de confirmation** (`/reserver/confirmation/[bookingId]`) : gardé
  par `requireGuestSession` (posé au Sprint 0, resté inutilisé jusqu'ici) —
  premier usage réel de ce garde.
- **Mesure e2e < 3 minutes** (CDC §11.3) : la traversée automatisée du
  tunnel (dates → identité → code → confirmation) est chronométrée dans
  `e2e/booking-flow.spec.ts` contre un seuil généreux — même réserve
  méthodologique que la chronométrie terrain du Sprint 1 (CDC §11.1) : ça
  ne mesure pas une saisie humaine réelle, seulement l'absence de
  régression pathologique.

## Un bug de fuseau horaire trouvé en revue manuelle, pas par la suite automatisée

La capture d'écran du calendrier propriétaire après une réservation
montrait les mauvais jours verrouillés — décalés d'un jour par rapport à
ce que la base contenait réellement. Cause : trois endroits calculaient un
« aujourd'hui » en heure **locale** du serveur (`new Date();
setHours(0,0,0,0)`) puis le comparaient à des clés dérivées en **UTC**
(`toISOString().slice(0,10)`) — correct seulement si le serveur tourne en
UTC, ce qui n'est pas le cas de ce conteneur de développement (CEST).
Corrigé par deux utilitaires UTC-purs (`startOfUtcDay`, `addUtcDays`) dans
`src/lib/booking/nights.ts`, appliqués aux trois points concernés
(calendrier propriétaire, sa sauvegarde, et le tunnel de réservation
lui-même). Détaillé en décision 0011 — la suite Playwright ne l'aurait
jamais vu, puisqu'elle compare la base à elle-même, jamais un jour affiché
à son intitulé visuel : c'est la revue manuelle au navigateur qui l'a
révélé, comme le bug de ratio d'image du Sprint 4 (décision 0010).

## Comment démontrer

```bash
docker compose up -d
npm run db:seed
npm run dev
```

Voyageur (`/logements/<un bien vérifié>`, bouton Réserver, sans compte) :
dates, identité, code OTP (journalisé en développement) — demande envoyée.
Propriétaire (`/connexion`, `+2250700000020`) : voit la demande dans sa
fiche de gestion, Accepter ou Refuser. `npm run bookings:expire-holds`
démontre l'expiration du verrou (script autonome, à planifier en cron).

`npm run test:e2e` — 17 tests au total, dont un nouveau parcours complet
voyageur → acceptation → refus (`booking-flow.spec.ts`).

## Rétrospective

- **Bien** : la revue manuelle au navigateur, demandée avant ce sprint pour
  les épics précédents, a été reconduite sur cette propre fonctionnalité
  au lieu de s'arrêter à la suite automatisée verte — c'est elle qui a
  trouvé le bug de fuseau horaire, invisible autrement.
- **À ajuster** : deux tests existants (`public-search.spec.ts`) se sont
  révélés fragiles face à un nouveau bien publié créé par un autre fichier
  de test tournant en parallèle — une fragilité déjà latente (le test
  d'approbation admin publie aussi un bien) mais jusqu'ici jamais
  déclenchée. Assertion de comptage total assouplie (« au moins 3 », pas
  « exactement 3 ») plutôt que de figer artificiellement l'ordre
  d'exécution des fichiers ; le nouveau test nettoie désormais son propre
  bien en fin d'exécution.
