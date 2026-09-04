# Sprint 7 — Litiges et recette finale

**Objectif** : les 5 critères d'acceptation du CDC §11 rejoués et
consignés.

Dernier sprint du découpage initial (plan de projet, S0-S7) — le backlog
v1 est maintenant complet, à l'exception de deux points explicitement hors
du périmètre d'un sprint de développement : le branchement du PSP réel
(épic 6.7, bloqué par le §12) et les 50 réservations réelles (épic 7.6,
jalon d'usage post-lancement).

## Livré

Toutes les stories de l'épic 7 :

- **Signalement d'écart par le voyageur** (CDC §4.2 dernier point,
  épic 7.1) : depuis `/reserver/confirmation/[bookingId]`, une fois le
  séjour en cours (`IN_PROGRESS`) — un seul signalement actif par
  réservation.
- **Déclenchement d'une contre-visite** (CDC §6.5.3, épic 7.2) : une
  contre-visite n'est pas un mécanisme séparé — c'est une
  `VerificationRequest` comme une autre, qui réutilise intégralement la
  file de planification admin, `ScheduleForm` et l'app terrain agent déjà
  construites (Sprints 2 et 4 et 1). Seul un nouveau lien
  (`Dispute.counterVisitRequestId`) distingue les deux, avec un badge
  « Contre-visite — Litige » dans la file admin pour que ça reste visible.
- **Retrait de mention suite à contre-visite défavorable** (CDC §4.2
  dernier point, §6.5.3, épic 7.3) : la fiche de revue existante
  (`/admin/fiches/[requestId]`) affiche un panneau de décision différent
  quand la fiche est liée à un litige (`DisputeReviewPanel`) — jamais
  « approuver » (une `Verification` ne peut de toute façon pas être créée
  une deuxième fois pour le même bien, contrainte d'unicité), mais
  « écart confirmé → retrait » ou « écart non confirmé → mention
  maintenue ».
- **Traitement des litiges au back-office** (CDC §6.5.3, épic 7.4) :
  `/admin/litiges` — liste globale, deux issues possibles pour un litige
  ouvert : déclencher une contre-visite, ou résoudre directement (mention
  gardée ou retirée) quand le signalement ne justifie pas de renvoyer un
  agent sur place (ex. nuisance de voisinage, hors du champ de ce qu'une
  visite peut constater).
- **Recette des 5 critères du §11** (épic 7.5) : `docs/agile/recette-v1.md`
  — quatre critères démontrés automatiquement (visite hors connexion,
  publication < 24h, réservation + paiement < 3 min, cycle de paiement
  complet), le cinquième (50 réservations réelles) explicitement hors
  périmètre développement, avec la méthode de mesure prévue en production.

## Une politique de libération incomplète, rattrapée en cours du Sprint 6

Pas une découverte de ce sprint, mais qui mérite d'être notée ici : le
Sprint 6 avait initialement construit la moitié « le voyageur confirme »
de la décision « voyageur ou délai 24h, le premier des deux » sans le
repli automatique. Rattrapé avant la clôture du sprint (voir
`docs/agile/sprints/sprint-06.md`) — mentionné à nouveau ici parce que
c'est exactement le genre d'écart qu'une story de recette comme 7.5 est
censée détecter : décider une politique et n'en construire que la moitié
la plus visible est un risque récurrent, pas un accident isolé.

## Comment démontrer

```bash
docker compose up -d
npm run db:seed
npm run dev
```

Voyageur : séjour en cours (après paiement + confirmation d'arrivée,
Sprint 6), signale un écart. Admin (`/admin/litiges`) : voit le litige,
déclenche une contre-visite ou résout directement. Pour une contre-visite :
`/admin`, planifie l'agent comme d'habitude, l'agent visite via
`/terrain`, l'admin décide sur `/admin/fiches/[requestId]` (panneau
« Issue de la contre-visite »).

`npm run test:e2e` — 22 tests au total, dont deux nouveaux pour les
litiges (contre-visite avec retrait de mention, résolution directe avec
mention maintenue).

## Une flakiness de charge qui s'accumulait depuis plusieurs sprints, réglée à la source

Deux tests indépendants (calendrier propriétaire au Sprint 5, à nouveau au
début de ce sprint) ont échoué par pure contention — la base interrogée
avec re-tentative jusqu'à 20 secondes, toujours dépassée, alors que le
même test rejoué seul passe en moins d'une seconde. À chaque fois, le
correctif ponctuel (regrouper deux vérifications dans la même
re-tentative) a fonctionné mais n'a pas traité la cause : la suite grossit
sprint après sprint, et 8 workers (la moitié des CPU logiques rapportées
par ce conteneur) se sont montrés trop pour les ressources réellement
disponibles en local. `playwright.config.ts` limite maintenant le
parallélisme local à 4 workers — CI garde son parallélisme par défaut,
déjà protégé par ses deux re-tentatives. Les deux correctifs ponctuels
restent en place (ils ne coûtent rien et documentent le raisonnement),
mais c'est cet ajustement d'infrastructure qui a réellement stabilisé la
suite.

## Rétrospective

- **Bien** : avoir reconnu qu'une contre-visite n'avait pas besoin d'un
  mécanisme séparé — la relire comme « une VerificationRequest de plus »
  a évité de dupliquer toute la chaîne planification → app terrain →
  revue, pour ne construire que ce qui change réellement (la décision
  finale).
- **Bien** : être remonté à la cause (contention sous charge) plutôt que
  d'empiler un troisième correctif ponctuel sur le même symptôme — la
  suite grossira encore, un correctif d'infrastructure tient mieux qu'un
  raisonnement test par test.
- **À ajuster** : ce dépôt n'a pas de suite d'intégration qui rejoue le
  parcours complet CDC §5 en une seule fois (voyageur → propriétaire →
  agent → admin, du signalement à la résolution) — chaque sprint a testé
  son propre morceau. Ça a suffi jusqu'ici parce que chaque morceau est
  isolé et vérifié ; à surveiller si un futur changement touche plusieurs
  surfaces à la fois.
