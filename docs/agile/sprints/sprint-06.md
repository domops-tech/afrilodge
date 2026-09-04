# Sprint 6 — Paiement

**Objectif** : cycle complet payé → arrivée → libération → commission sur
le simulateur.

## Points ouverts §12 tranchés à la planification

Trois décisions produit posées avant le début du sprint (positions par
défaut du plan, toutes confirmées) :

- **Déclencheur de libération** : le voyageur confirme son arrivée, ou un
  délai automatique de 24h après l'heure d'arrivée prévue si non fait — le
  premier des deux (CDC §5.1.7, §8.6).
- **Politique d'annulation** : une règle globale unique, paramétrable en
  back-office, jamais par le propriétaire — délai de remboursement
  intégral avant l'arrivée (CDC §6.2.6, §8.7).
- **Commission** : prélevée sur le propriétaire, taux configurable en
  back-office (CDC §6.5.4, §8.8).

## Livré

Toutes les stories de l'épic 6 :

- **Intention de paiement à l'acceptation** (CDC §8.1, 6.1) :
  `acceptBookingAction` crée l'intention (`Payment.status =
  INTENT_CREATED`) via le port `PaymentProvider` posé au Sprint 0 — le
  calendrier reste `HELD`, rien n'est encore conservé.
- **Redirection vers l'établissement de paiement** (CDC §6.2.3, 6.2) :
  `/reserver/paiement/[bookingId]` tient lieu d'écran du PSP tant que le
  §12 n'est pas tranché — brancher un PSP réel remplacera son bouton par
  une vraie redirection, sans toucher au reste du tunnel (décision 0002).
- **Webhook vérifié et idempotent** (CDC §8.4, 6.3) :
  `/api/payments/webhook`, signature HMAC vérifiée avant tout traitement,
  idempotence garantie par `PaymentEvent.externalId` (contrainte
  d'unicité + `skipDuplicates`, pas un `findUnique` puis `create` qui
  laisserait une fenêtre de course). Un seul point d'entrée
  (`processPaymentWebhook`) pour les trois événements (`funds.held`,
  `funds.released`, `funds.refunded`) — l'état d'un paiement ne suit
  jamais un appel sortant seul, uniquement ce chemin.
- **Confirmation d'arrivée → libération** (CDC §5.1.7, §8.6, 6.4) : le
  voyageur confirme depuis `/reserver/confirmation/[bookingId]`, ce qui
  démarre le séjour (`IN_PROGRESS`) et ordonne la libération — dévoile
  aussi le code de séjour et les coordonnées d'accès GPS, masqués jusque-là
  (CDC §5.1.6, §6.1.5). **Repli automatique à 24h** posé en cours de
  sprint (voir plus bas) : `POST /api/payments/release-overdue`.
- **Annulation et remboursement** (CDC §6.2.6, §8.7, 6.5) : libre et sans
  remboursement tant qu'aucun paiement n'est conservé ; au-delà, soumise
  au délai de remboursement intégral paramétré en back-office — passé ce
  délai, l'annulation en libre-service n'est pas proposée (pas de logique
  de pénalité non spécifiée par le CDC inventée pour compenser).
- **Journal des commissions** (CDC §6.5.4, §8.8, 6.6) :
  `/admin/commissions` — total réglé/en attente, une ligne par réservation
  avec propriétaire et taux.
- **Paramètres globaux** : `/admin/parametres` (taux de commission, délai
  de remboursement), nouveau modèle `PlatformSetting` (clé/valeur), avec
  valeurs par défaut si l'admin n'a rien encore enregistré.

## Un repli automatique posé en cours de sprint, pas prévu au découpage initial

La story 6.4 ne couvrait explicitement que la confirmation d'arrivée par
le voyageur — mais la décision prise avec vous en planification est « le
voyageur **ou** un délai de 24h, le premier des deux ». Construire
uniquement la moitié voyageur de cette décision aurait laissé le repli
automatique silencieusement de côté. Ajouté en cours de sprint :
`POST /api/payments/release-overdue`, protégé par un secret partagé.

Volontairement une **route HTTP**, pas un script `tsx` sous `scripts/`
comme les deux tâches planifiées précédentes (`expire-verifications.ts`,
`expire-booking-holds.ts`) : le simulateur de paiement garde son état en
mémoire du process (décision 0012 ci-dessous), un script lancé à part ne
le partagerait jamais avec le serveur applicatif en cours d'exécution.

En la construisant, un deuxième défaut est apparu : un échec de
`release()` (panne transitoire du PSP en réalité, référence non
retrouvée dans le cas du simulateur) laissait la réservation `IN_PROGRESS`
avec le paiement bloqué `HELD`, sans aucun moyen de rejouer la
libération — la requête de relance ne cherchait que les arrivées jamais
confirmées. `confirmArrivalAndRelease` est maintenant idempotente
(chaque étape ne s'exécute que si elle ne l'a pas déjà été), et la route
retente aussi les libérations restées bloquées, pas seulement les
arrivées non confirmées.

## Le simulateur a un état caché que les vrais PSP n'ont pas

En construisant la suite e2e, un test qui fabriquait lui-même un webhook
`funds.held` signé (pour tester la vérification de signature et
l'idempotence en isolation) faisait ensuite échouer `release()` avec
« fonds non conservés », alors que `Payment.status` montrait bien `HELD`
en base. Cause : `SimulatedMobileMoneyProvider` tient un second état en
mémoire du process, distinct de la base, mis à jour uniquement par
`simulatePayerCompletion()` — jamais par un webhook traité indépendamment.
Avec un vrai PSP cette divergence est structurellement impossible (le
webhook *est* sa façon de nous informer de son propre état). Détaillé en
décision 0012 : toute séquence qui doit ensuite appeler `release()` doit
payer via le vrai bouton de l'interface, pas via un webhook fabriqué à la
main — `e2e/payment-flow.spec.ts` sépare pour cette raison le test de
webhook (s'arrête à `PAID`) de celui de libération (interface réelle,
jusqu'à `RELEASED`).

## Comment démontrer

```bash
docker compose up -d
npm run db:seed
npm run dev
```

Voyageur : réserve un bien vérifié, propriétaire (`+2250700000020`)
accepte — l'intention de paiement se crée. Voyageur : `/reserver/paiement/
<id>`, « Payer via Mobile Money (simulateur) » — réservation payée, code
de séjour et coordonnées d'accès révélés. « Confirmer mon arrivée » —
séjour en cours, fonds libérés. Admin (`/admin/commissions`) : la
commission apparaît, réglée. `/admin/parametres` : taux et délai
modifiables. `curl -X POST -H "x-cron-secret: $CRON_SECRET"
localhost:3000/api/payments/release-overdue` : libère les réservations
payées dont l'arrivée n'a pas été confirmée sous 24h.

`npm run test:e2e` — 20 tests au total, dont trois nouveaux pour le
paiement (webhook vérifié + idempotent, paiement + libération via
l'interface, annulation + remboursement).

## Rétrospective

- **Bien** : avoir remonté les trois points du §12 à la planification
  plutôt que d'appliquer les positions par défaut du plan sans le dire —
  la décision de le faire était déjà actée dans `docs/agile/plan`, il
  restait à la tenir au bon moment.
- **Bien** : avoir suivi le fil du repli à 24h jusqu'au bout (route +
  idempotence de `confirmArrivalAndRelease`) plutôt que de livrer la
  moitié « voyageur confirme » de la décision et de considérer la story
  faite — une décision produit actée avec vous n'est pas à moitié
  construite.
- **À ajuster** : le simulateur de paiement a maintenant deux endroits où
  regarder pour comprendre l'état d'un paiement (la base, sa Map en
  mémoire) — gênant pour écrire des tests, invisible en production avec
  un vrai PSP. Pas de raison de le corriger avant le Sprint 7 (aucune
  nouvelle story n'en dépend), mais à garder en tête si un test échoue
  encore de cette façon.
