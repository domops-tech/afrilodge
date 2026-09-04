# 0012 — L'état interne du simulateur de paiement doit toujours venir d'un webhook, jamais être fabriqué à côté

**Statut** : bug de test découvert et corrigé en construisant la suite e2e
du Sprint 6 (paiement). Concerne quiconque écrit un test — ou un script —
qui interagit avec `SimulatedMobileMoneyProvider`.

## Le symptôme

Un test faisait passer une réservation à `PAID` en construisant lui-même un
événement `funds.held` signé et en l'envoyant à `/api/payments/webhook`,
sans passer par `simulateGuestPayment` (voir src/lib/payments/simulated.ts).
La réservation passait bien à `PAID` en base — mais l'étape suivante, la
confirmation d'arrivée du voyageur (qui appelle `provider.release()`),
échouait systématiquement avec `Impossible de libérer des fonds non
conservés`.

## Cause

`SimulatedMobileMoneyProvider` tient deux états séparés pour un même
paiement :

1. **La base** (`Payment.status`) — mise à jour uniquement par
   `processPaymentWebhook` (src/lib/payments/webhook-handler.ts), jamais par
   un appel sortant seul (voir décision 0002, plan — Architecture cible).
2. **Une `Map` en mémoire du process** (`this.state` dans la classe), mise à
   jour uniquement par `simulatePayerCompletion()` (appelée par
   `simulateGuestPayment`) et par `release()`/`refund()` eux-mêmes.

`release()` vérifie cette Map avant d'agir (`this.state.get(ref) !==
"held"` → erreur). Fabriquer un webhook `funds.held` à la main met à jour
1. sans jamais toucher 2. : les deux divergent, et `release()` échoue plus
tard sur une intention pourtant bien `HELD` en base.

Ce n'est pas un bug de l'application — avec un vrai PSP, cette divergence
est structurellement impossible : le webhook *est* la façon dont le PSP
nous informe de son propre état interne, les deux ne peuvent jamais
diverger. C'est un artefact du simulateur, qui a besoin d'un second état
séparé (la Map) précisément parce qu'il joue aussi le rôle du PSP, pas
seulement celui de l'appelant.

## Décision

Toute séquence de test qui doit ensuite appeler `release()` sur une
intention doit faire passer cette intention par `PAID` **via le vrai
bouton de paiement de l'interface** (`/reserver/paiement/[bookingId]`),
qui appelle `simulateGuestPayment` puis envoie le webhook — jamais en
fabriquant le webhook à la main. Fabriquer un webhook à la main reste
légitime pour tester la vérification de signature et l'idempotence en
isolation (CDC §8.4, épic 6.3), ou pour amener une réservation à `PAID`
dans un scénario qui n'appellera jamais `release()` (ex. test
d'annulation/remboursement : `refund()` ne vérifie pas l'état interne,
contrairement à `release()`) — voir `e2e/payment-flow.spec.ts`, qui
sépare pour cette raison le test de webhook (fabriqué, s'arrête à `PAID`)
du test de libération (interface réelle, jusqu'à `RELEASED`).

## Quand appliquer ce correctif

Dès qu'un nouveau test ou script doit enchaîner paiement puis libération
des fonds sur le simulateur. Si `release()` échoue avec « fonds non
conservés » alors que `Payment.status` montre bien `HELD` en base, c'est
ce décalage — vérifier que le paiement est bien passé par
`simulateGuestPayment`, pas par un webhook fabriqué à la main.
