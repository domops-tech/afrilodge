# 0008 — Budget de poids par test Playwright, pas Lighthouse CI

**Statut** : actée en construisant la recherche publique (épic 3, story 3.6).

## Contexte

Le plan de sprint prévoyait Lighthouse CI pour contrôler le budget de
poids des pages publiques (CDC §7.3 : « un budget en kilo-octets par fiche
doit être fixé et contrôlé »), avec les chiffres : vignette de liste
≤ 30 Ko, premier écran de fiche détaillée ≤ 800 Ko.

## Décision

Contrôler ce budget par un test Playwright qui mesure les octets
réellement transférés (`e2e/performance-budget.spec.ts`), pas par
Lighthouse CI.

## Pourquoi

- **Même intention, outillage déjà éprouvé.** L'objectif réel est un
  garde-fou de régression en CI sur le poids des pages — pas
  spécifiquement un score Lighthouse ou des métriques Core Web Vitals.
  Playwright tourne de façon fiable dans ce dépôt depuis le Sprint 0 ;
  Lighthouse CI aurait introduit une seconde chaîne de lancement de
  Chrome (drapeaux, sandboxing) dans un environnement conteneurisé, avec
  un risque de fragilité non nécessaire pour ce que la CDC demande
  réellement.
- **Mesure directe, pas une estimation.** `response.body()` donne les
  octets exacts transférés pour chaque ressource ; le test additionne les
  ressources de première partie (notre origine applicative et notre
  stockage objet) et exclut délibérément les tiers (la carte OpenStreetMap
  en iframe, voir `src/components/ApproximateMap.tsx`) — même logique
  qu'un rapport Lighthouse qui distingue premier et tiers parti.

## Un vrai bug de conception attrapé en écrivant ce test

Le premier jet de la carte de résultat de recherche affichait la photo en
pleine largeur de carte, avec un `sizes` du type `100vw` sur mobile. Sur un
écran étroit à forte densité de pixels, le navigateur demandait alors un
fichier bien plus lourd que prévu (~40 Ko au lieu des ~5 Ko attendus) —
le test a échoué avant même d'être ajusté pour « passer ». Corrigé en
redessinant la carte avec une vraie vignette de taille fixe (96×96) au
lieu d'une photo pleine largeur : plus fidèle au mot du CDC lui-même
(« vignette »), et cohérent avec le principe déjà établi en décision 0007
que `sizes` doit refléter la taille d'affichage réelle, pas un défaut
générique.

## Fixture de test réaliste, pas juste valide

`e2e/fixtures/sample.jpg` est passée d'une image 1×1 (Sprint 1/2, pensée
pour la rapidité) à une photo 1600×1067 avec un bruit de dégradé
(~360 Ko source, une image en aplat de couleur compresserait de façon
irréaliste quelle que soit la taille demandée). Sans cette fixture
réaliste, ce budget n'aurait rien pu attraper : c'est elle qui a rendu le
bug ci-dessus visible.

## Ce que ça ne remplace pas

Ce test ne donne ni score de performance global, ni métriques Core Web
Vitals (LCP, CLS…). Si un besoin de suivi plus riche apparaît (tableau de
bord de performance dans le temps, par exemple), Lighthouse CI reste une
option à réévaluer alors — ce n'était pas nécessaire pour satisfaire
l'exigence mesurable du CDC.
