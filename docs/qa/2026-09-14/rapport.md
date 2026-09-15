# Audit qualité — logements-meuble — 14 septembre 2026

> Suivi : les corrections et la recette finale sont consignées dans [corrections.md](corrections.md). Le texte ci-dessous conserve les constats initiaux.

Avis : recette partielle, corrections importantes nécessaires avant validation du parcours voyageur et des paiements. Audit local du code et de l’application ; aucune correction fonctionnelle effectuée.

## Vérifications exécutées

| Contrôle | Résultat |
|---|---|
| ESLint | Réussi. Première tentative perturbée par la suppression concurrente de test-results par Playwright ; relance seule réussie. |
| TypeScript | Réussi (`npm run typecheck`). |
| Vitest | 48 tests réussis, 6 fichiers. |
| Build production | Réussi via le lancement E2E hors bac à sable. Échec initial de téléchargement Google Fonts dans le bac à sable. |
| Schéma PostgreSQL | 8 migrations, schéma à jour. |
| Playwright existant | 19 réussites, 2 échecs, 1 non exécuté, environ 1 min 12 s après démarrage des dépendances. |
| Audit d’affichage supplémentaire | 8 pages × 2 largeurs (360 et 1440 px), HTTP 200, aucun débordement horizontal ni image chargée en échec détecté. |
| Session voyageur absente | Redirection vers `/fr/reserver`, réponse 404, reproduite aux deux largeurs. |

Les conteneurs PostgreSQL et MinIO ont été démarrés avec autorisation. La première suite E2E, avant ce démarrage, échouait principalement sur `DatabaseNotReachable` ; elle ne constitue pas le bilan applicatif ci-dessus. Le seed n’a pas été relancé : il efface les données existantes. Les tests existants créent des comptes et données de test, avec leur propre nettoyage partiel.

## Parcours

| Parcours | Constat |
|---|---|
| Accueil FR/EN | Redirection et changement de langue réussis. |
| Recherche et fiche | Quartier, budget, chargement des images, mention de vérification et masquage du contact réussis. Budgets vignette ≤ 30 Ko et fiche ≤ 800 Ko réussis selon le périmètre des tests. |
| Propriétaire | Connexion OTP, création de bien, demande de vérification, planification admin, calendrier, refus et nouvelle demande réussis. |
| Voyageur | Réservation sans compte, acceptation/refus, paiement simulé, remboursement, signalement et résolution de litige réussis dans les scénarios existants. Des défauts hors scénario nominal subsistent ci-dessous. |
| Terrain hors connexion | Non validé pendant cet audit : après connexion, le lien « Studio cosy, Plateau » attendu par le test est absent ; délai de 60 s dépassé avant le démarrage de la visite. |
| Validation administrative | Non validée pendant cet audit : lien « Villa meublée, Bingerville » absent de la file attendue ; délai de 30 s dépassé. Le test de refus suivant est sauté par le mode série. La villa apparaît déjà publiée dans les captures publiques. |

Les tests terrain et validation dépendent de fiches fixes du seed et les font évoluer. Ils ne préparent pas chacun un état indépendant : une suite rejouée sur une base déjà utilisée ne peut pas être considérée comme reproductible. Prévoir une base de recette isolée et des fixtures propres à chaque test.

## Anomalies prioritaires

### Q01 — Haute — réservation inaccessible après expiration de session

Preuve navigateur : ouvrir `/fr/reserver/confirmation/audit-session-absente` sans cookie termine sur `/fr/reserver` en 404. `src/lib/auth/session.ts` fixe la session voyageur à six heures ; `src/lib/auth/guard.ts`, `requireGuestSession`, redirige vers cette route inexistante. Aucun parcours de récupération d’une ancienne réservation par OTP n’a été trouvé. La confirmation exige l’égalité du `guestSessionId`.

Impact : le voyageur revenant le lendemain ne peut plus payer, consulter ses accès, confirmer son arrivée ou signaler un problème. Une seconde réservation crée une autre session et remplace aussi le cookie de la première.

Attendu : récupération sécurisée par téléphone/OTP, conservation du lien vers la réservation demandée et écran explicite de session expirée. Tester expiration, retour sur un autre appareil et deux réservations successives.

### Q02 — Haute — confirmation d’arrivée et libération des fonds anticipées

`src/app/[locale]/(booking)/reserver/confirmation/[bookingId]/actions.ts`, `confirmArrivalAction`, vérifie uniquement le statut PAID et l’existence d’un paiement. `src/lib/payments/release.ts` libère ensuite les fonds sans comparaison avec `checkIn`. Le bouton est affiché pour toute réservation PAID.

Preuve exécutée : `e2e/payment-flow.spec.ts:163` réussit avec `checkInOffsetDays: 8`, puis confirme immédiatement l’arrivée et la libération.

Impact : une action prématurée déclenche un séjour et un versement huit jours avant l’arrivée prévue. Définir la fenêtre métier d’arrivée et la contrôler côté serveur et interface ; ajouter le scénario négatif.

### Q03 — Haute — règles métier contournables à la confirmation de réservation

`src/app/[locale]/(booking)/reserver/[propertyId]/actions.ts`, `confirmBookingAction`, relit des champs cachés modifiables puis vérifie seulement les conflits de calendrier dans la transaction. Il ne rappelle pas `checkPropertyAndRange`. Le schéma ne compare pas les dates et ne contrôle pas la capacité maximale. `isRangeAvailable` recherche seulement des journées occupées.

Scénarios à reproduire sur base isolée après obtention d’un OTP : modifier `guests` au-delà de la capacité ; inverser les dates sur une période libre ; retirer la publication ou faire expirer la vérification entre les étapes. Des dates passées sont également interdites seulement par le minimum HTML, pas par les actions serveur.

Constat statique, pas d’insertion volontaire de réservation incohérente pendant cet audit. Attendu : validation complète de l’ordre des dates, du passé, de la capacité, de la publication et de la vérification active dans la transaction finale. Ne pas considérer les étapes précédentes comme une autorisation persistante.

### Q04 — Haute — webhook marqué traité avant application complète

`src/lib/payments/webhook-handler.ts:121` insère `PaymentEvent` avant d’exécuter le traitement métier. Une livraison suivante avec le même `externalId` s’arrête si cet enregistrement existe. Les modifications du paiement, du séjour, du calendrier et de la commission se font en plusieurs opérations distinctes.

Scénario déduit du code, panne non injectée : interruption après insertion de l’événement mais avant fin du traitement ; le renvoi du même événement est ignoré et ne répare pas l’état incomplet. Le test d’idempotence nominal réussi ne couvre pas ce cas.

Attendu : transaction cohérente pour les écritures locales ou suivi explicite reçu/en cours/traité avec reprise des échecs. Tester l’interruption puis le rejeu.

### Q05 — Haute — protection du calendrier incomplète

`src/app/[locale]/(owner)/proprietaire/biens/[propertyId]/actions.ts`, `updateAvailabilityAction`, parcourt 60 jours mais charge les lignes avec `lt: window[window.length - 1]` : le dernier jour est exclu de la lecture. Cocher le dernier jour déjà HELD/BOOKED passe donc dans l’upsert et peut remplacer son statut par BLOCKED. De plus, la lecture des statuts est faite hors transaction : une réservation intervenant entre lecture et écriture peut être écrasée.

Constat statique. Attendu : borne couvrant les 60 jours et écriture conditionnelle sur le statut courant, avec test du dernier jour et d’une mise à jour concurrente.

## Affichage et ergonomie

### Q06 — Moyenne — galerie disproportionnée sur bureau

Preuve : [fiche 1440 px](1440-6.png). La première image occupe deux rangées via `row-span-2` mais garde une hauteur automatique ; un grand trou apparaît sous elle. Les sept images repoussent titre, prix et bouton de réservation très bas. Sur mobile, toute la galerie précède aussi le prix et l’action : [fiche 360 px](360-6.png).

Source : `src/app/[locale]/(public)/logements/[propertyId]/page.tsx:78-88`. Corriger la géométrie de la grille et rapprocher titre, prix et action du premier écran. Les motifs multicolores sont les images de démonstration présentes en stockage ; leur aspect ne prouve pas un défaut de décodage.

### Q07 — Moyenne — dates et voyageurs perdus entre recherche et réservation

Constat statique : la carte de recherche transmet uniquement l’identifiant du logement ; le lien vers la réservation fait de même ; `BookingWizard` initialise ses dates à vide. Le retour à la recherche utilise également une URL sans filtres.

Reproduction : rechercher avec dates et voyageurs, ouvrir une fiche, cliquer Réserver ; il faut ressaisir la sélection. Attendu : propager les paramètres et les revalider côté serveur.

### Q08 — Moyenne — recherche aux dates incohérentes sans explication

`src/app/[locale]/(public)/recherche/page.tsx` applique la disponibilité uniquement si départ > arrivée. Une période inversée ou partielle désactive silencieusement le filtre et affiche des biens. Attendu : message de validation explicite et aucune promesse implicite de disponibilité.

### Q09 — Moyenne — structure accessible à compléter

Mesures DOM conservées dans [visual-results.json](visual-results.json) : les six pages hors accueil de chaque largeur n’ont pas de repère `main`. L’accueil et la fiche imbriquent un bouton dans un lien (`a button`). `Field.tsx` ne relie pas son message d’erreur au champ par `aria-describedby` et ne pose pas `aria-invalid`.

Attendu : repère principal, un seul élément interactif par action de navigation et association explicite des erreurs. Les champs possèdent déjà des labels et une hauteur minimale de 44 px. Aucun audit complet au lecteur d’écran n’a été réalisé.

## Limites et suites de recette

- Les captures couvrent accueil FR/EN, recherche FR, connexions propriétaire/admin/terrain, une fiche et son formulaire de réservation. Les espaces authentifiés sont couverts par les E2E réussis, pas par une inspection visuelle exhaustive.
- Aucun test sur téléphone physique, Safari/Firefox, thème sombre ou réseau mobile ralenti. Le profil Playwright se nomme « Android d’entrée de gamme, réseau lent », mais configure seulement l’émulation Pixel 7 ; aucune limitation CPU ou réseau n’est appliquée dans cette configuration. Les moins de trois minutes en usage humain restent à mesurer.
- La carte externe apparaît vide sur les captures prises peu après navigation ; ce seul constat ne permet pas de conclure à une panne permanente du service cartographique.
- SMS et paiements utilisent les simulateurs locaux. Aucun SMS ni paiement réel n’a été initié. La route de récupération OTP de développement doit rester fermée en exploitation via la configuration prévue ; ce déploiement n’a pas été audité.
- Le build émet un avertissement sur `next start` avec `output: standalone` : aligner le script de démarrage et la méthode de déploiement prévue.
- Les budgets E2E portent sur les ressources propres au projet ; ils excluent la carte tierce et ne remplacent pas une mesure de performance sur appareil réel.

Priorité proposée : corriger Q01–Q05, fiabiliser les fixtures terrain/admin, rejouer les parcours négatifs et les paiements interrompus, puis traiter Q06–Q09 et compléter la recette d’accessibilité et d’usage mobile.

Les 16 captures et le relevé JSON sont conservés dans ce dossier. Le test temporaire de capture a été retiré après exécution ; aucun fichier applicatif n’a été modifié.
