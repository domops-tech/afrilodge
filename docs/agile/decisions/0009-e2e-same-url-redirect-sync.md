# 0009 — Vérifier en base avec re-tentative, pas l'URL, quand une action redirige vers sa propre page

**Statut** : correctif appliqué en construisant l'espace propriétaire
(épic 4 : calendrier, planification admin). Concerne toute Server Action
appelée depuis un formulaire simple qui redirige vers la page où elle est
déjà affichée — cas fréquent (« Enregistrer », « Planifier »…) qui
reviendra dans les sprints suivants (réservation, paiement).

## Le symptôme

Le test e2e du calendrier de disponibilité échouait de façon
irrégulière : la case décochée puis le formulaire soumis, la ligne
`AvailabilityDay` restait « BLOCKED » en base au moment de la vérification
— alors qu'une requête `psql` lancée juste après le test la montrait
correctement supprimée. Le serveur, interrogé immédiatement après sa
propre transaction (journalisation temporaire), confirmait systématiquement
la suppression. Le défaut n'était donc ni dans `updateAvailabilityAction`,
ni dans la donnée : il était dans la synchronisation du test avec l'issue
réelle de la soumission.

## Pourquoi `toHaveURL` et `waitForLoadState("networkidle")` ne suffisent pas ici

Ces deux formulaires (`updateAvailabilityAction`, `scheduleVisitAction`)
redirigent vers **la page depuis laquelle ils sont soumis**. Une
soumission de `<form action={ServerAction}>` non enrichie côté client (pas
de `useActionState`) est tout de même interceptée par le routeur
client de Next.js, qui traite la redirection comme une navigation gérée en
React Server Components plutôt qu'un rechargement de document classique :

- `toHaveURL` peut se trouver déjà satisfaite avant même la fin du cycle,
  puisque l'URL cible est identique à l'URL de départ — l'assertion ne
  prouve rien sur l'état du serveur.
- `waitForLoadState("networkidle")` s'est montré tout aussi peu fiable pour
  ce cas précis : rien ne garantit que la re-synchronisation du DOM par le
  routeur RSC coïncide avec la fin de l'activité réseau observable par
  Playwright.

## Décision

Vérifier l'état en base avec re-tentative (`expect(async () => {...
}).toPass({ timeout: 10_000 })`) plutôt que d'essayer de deviner le bon
signal navigateur à attendre. Voir `e2e/owner-space.spec.ts`.

## Quand appliquer ce correctif

Dès qu'un test e2e vérifie l'effet d'une action qui **redirige vers la
page où l'utilisateur se trouve déjà** — reconnaissable au premier coup
d'œil dans le code de l'action (`backTo(propertyId, ...)` ou équivalent
ciblant l'URL courante). Pour une action qui change réellement de page
(ex. `approveVerificationAction` vers `/admin`, `createPropertyAction` vers
la fiche nouvellement créée), `toHaveURL` reste fiable : l'assertion ne
peut pas être satisfaite par hasard puisque l'URL change effectivement.
