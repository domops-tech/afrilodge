# Sprint 3 — Recherche et consultation publique

**Objectif** : un voyageur recherche et ouvre une fiche vérifiée, budget de
poids tenu.

## Livré

Toutes les stories de l'épic 3 :

- Recherche par quartier, dates, budget et nombre de voyageurs
  (`/recherche`) — formulaire GET classique, fonctionne sans JavaScript
  (CDC §2, réseau dégradé). Ne liste que des biens publiés dont la
  vérification est active à l'instant présent, pas seulement au moment de
  la publication (même principe que `isVerificationValid`).
- Filtrage par dates : absence de ligne `AvailabilityDay` = disponible
  (CDC §7.3) — la recherche n'exclut que les biens portant un jour
  explicitement non-OPEN. Aucune réservation n'existe encore (épic 5), donc
  ce filtre est un no-op pour l'instant, mais la plomberie est prête sans
  qu'aucun changement ne soit nécessaire au moment où les réservations
  arriveront.
- Liste de résultats en vraies vignettes (96×96, taille fixe) — pas des
  photos pleine largeur, voir plus bas.
- Fiche détaillée (`/logements/[propertyId]`) : galerie de photos, date de
  vérification et **nom de l'agent** toujours affichés (CDC §6.1.3),
  équipements réellement constatés par la visite (pas la déclaration du
  propriétaire — nécessite un correctif, voir plus bas), points de repère
  d'accès.
- Carte de situation approximative (CDC §6.1.4) : coordonnées arrondies à
  ~1 km, embed OpenStreetMap sans bibliothèque JS ajoutée à notre bundle.
- Coordonnées et contact du propriétaire jamais sélectionnés dans la
  requête de la fiche publique (CDC §6.1.5) — pas un filtrage a
  posteriori, structurellement absent.
- Budget de poids contrôlé en CI par un test Playwright plutôt que
  Lighthouse CI (`e2e/performance-budget.spec.ts`, décision 0008).

## Deux corrections de cohérence de données découvertes en construisant l'écran public

Rien de tout ça n'était visible avant que quelque chose n'affiche
réellement les données constatées sur le terrain :

1. **Équipements** : `PropertyAmenity.confirmed` n'était jamais mis à jour
   depuis `AmenityCheck` (le constat de l'agent) — la fiche publique aurait
   affiché la déclaration du propriétaire, pas ce qui a été vérifié.
   Corrigé dans l'action d'approbation admin (épic 2).
2. **Position** : `Property.latitude`/`longitude` n'étaient jamais copiés
   depuis `Visit.checkInLatitude`/`checkInLongitude` — la carte n'aurait
   rien eu à afficher. Corrigé à la fois à la synchronisation (épic 1) et,
   en filet de sécurité, à l'approbation (épic 2), pour couvrir aussi les
   données de démonstration insérées directement.

## Un vrai bug de conception attrapé par le test de budget, pas juste un chiffre à ajuster

La première version de la carte de résultat affichait la photo en pleine
largeur (`sizes="100vw"` sur mobile) : sur un écran étroit à forte densité,
le navigateur demandait un fichier ~8× plus lourd que nécessaire. Le test
de budget a échoué avant tout ajustement de seuil — corrigé en redessinant
la carte en vraie vignette de taille fixe, plus fidèle au mot du CDC
lui-même. Détail complet en décision 0008, qui documente aussi pourquoi la
fixture de test a dû devenir une photo réaliste (1600×1067) : une image
1×1 ne peut pas révéler ce genre de régression, quelle que soit la taille
demandée.

## Comment démontrer

```bash
docker compose up -d
npm run db:seed
npm run dev
```

`/fr/recherche` sans filtre liste les trois biens vérifiés. Filtrer par
quartier (« Angré ») ou budget max réduit les résultats. Ouvrir une fiche
affiche la galerie, la date de vérification, l'agent, les équipements
constatés, les points de repère et la carte approximative.

`npm run test:e2e` couvre recherche, filtres, fiche détaillée, masquage du
contact propriétaire, 404 sur fiche inexistante, et les deux budgets de
poids (13 tests au total, tout le dépôt confondu).

## Rétrospective

- **Bien** : avoir résisté à assouplir le seuil de 30 Ko quand le test a
  échoué — la cause était un vrai défaut de conception (image
  surdimensionnée), pas un budget mal calibré.
- **À ajuster** : deux corrections de cohérence de données (équipements,
  position) auraient dû être faites dès les sprints qui les concernaient
  (S1, S2), pas découvertes seulement quand un écran les a rendues
  visibles. Réflexe pour la suite : quand un champ est documenté comme
  « renseigné par X », vérifier immédiatement que X le fait réellement,
  pas seulement que le schéma le permet.
