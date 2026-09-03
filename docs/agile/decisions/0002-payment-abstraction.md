# 0002 — Abstraction de paiement + simulateur Mobile Money

**Statut** : actée avec vous à la planification du Sprint 0.

## Contexte

Le CDC pose un préalable bloquant en §12 : l'établissement de paiement
agréé BCEAO n'est pas choisi, et il faut obtenir par écrit que la
conservation conditionnelle est bien un de ses services régulés — sans
quoi « la conception s'arrête ici » (CDC, fin de la §8).

## Décision

Développer tout le produit derrière le port `PaymentProvider`
(`src/lib/payments/provider.ts` : `createIntent`, `getStatus`, `release`,
`refund`, `verifyWebhook`) avec un adaptateur simulateur
(`src/lib/payments/simulated.ts`) qui reproduit le contrat complet :
intention, conservation, libération, remboursement, webhooks signés et
idempotents.

## Pourquoi

- Permet de construire et de démontrer tout le cycle de réservation
  (Épics 4, 5, 6) sans attendre la décision commerciale du §12.
- Aucun code n'est jeté quand le PSP réel sera choisi : un seul nouveau
  fichier implémentant la même interface, aucun appelant ne change (voir
  backlog, story 6.7).
- Respecte la contrainte absolue du CDC §2/§10.1 : aucun fonds ne transite
  par VD Technologies, y compris dans la simulation — le simulateur ne
  fait que refléter un état déclaré, jamais détenir de valeur réelle.

## Ce qui reste bloquant malgré l'abstraction

Le développement peut avancer, **pas la mise en production**. La v1 ne part
pas en production sans la confirmation écrite de l'établissement agréé que
la conservation conditionnelle est bien l'un de ses services régulés (voir
plan — table « Points à trancher »).

## Note technique

Le simulateur garde son état sur `globalThis`, pas sur une variable de
module — voir la fiche 0001, dernier point. Important pour le Sprint 6 :
la création d'intention (Server Action) et la réception du webhook (Route
Handler) sont deux bundles Next.js distincts.
