# Refonte frontend — vérification visuelle

Les captures de la version refondue sont dans `after/`. Elles couvrent l’accueil, la recherche, une fiche de logement, les deux premières étapes de réservation, la reprise d’une demande et la connexion. Les largeurs contrôlées sont 320, 360, 390, 600, 768, 1024, 1440 et 1920 px CSS. Le cas de zoom 200 % est représenté par sa largeur utile équivalente de 640 px CSS sur un écran de 1280 px. `results.json` consigne l’absence de débordement horizontal mesuré.

Il n’y a pas de capture initiale exploitable pour une comparaison avant/après : la première série `before/` a été produite après le démarrage de la refonte et ne représente pas l’interface d’origine.

La direction visuelle utilise une palette de tons chauds et de vert profond, une typographie de titres à empattements et des composants partagés. Les mises en page changent selon l’espace disponible ; le formulaire de réservation et les cartes ont été inspectés sur téléphone et grand écran.

## Données visibles dans l’environnement de test

Le seed du dépôt fournit des annonces fictives situées à Abidjan, pas un catalogue réel de Cotonou. Les annonces de seed et le logement de fixture E2E sont maintenant marqués « Logement de démonstration » dans le produit. Le dépôt ne contient pas de photographie authentique de logement publiable : les emplacements photo affichent un placeholder qui nomme explicitement ce manque. Aucune image générée ni photo de stock n’est présentée comme un bien réel.

La carte de localisation est l’intégration déjà présente au projet. Elle est restée vide dans les captures de cet environnement ; son rendu dépend du service externe et n’a pas été validé ici.

## Contrôles exécutés

- `npm run typecheck`, `npm run lint` et `npm test`.
- Build de production Next.js.
- Parcours Playwright de recherche, réservation, connexion, paiement simulé, espace propriétaire et outils de visite, sans effectuer de paiement réel.
- Captures de navigateur sur les huit largeurs ci-dessus, y compris l’étape identité de la réservation.

Ces contrôles ciblent les pages et parcours modifiés ; ils ne constituent pas une déclaration de conformité WCAG complète ni une mesure de performance terrain.
