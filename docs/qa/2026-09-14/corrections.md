# Corrections de l’audit qualité — 14 septembre 2026

Les neuf anomalies Q01–Q09 du rapport ont reçu une correction. Validation locale finale : **71 tests unitaires et 28 tests navigateur réussis**, aucun test ignoré. TypeScript, ESLint, build de production et `git diff --check` passent.

| Anomalie | Correction | Preuve principale |
|---|---|---|
| Q01 — Session expirée | Page Mes réservations, récupération SMS avec retour vers la réservation, accès aux différentes réservations du téléphone vérifié ; refus pour un autre voyageur. | `e2e/qa-regressions.spec.ts`, récupération et deux réservations ; accès tiers 404. |
| Q02 — Arrivée prématurée | Contrôle côté serveur central et action, bouton disponible seulement à partir du jour d’arrivée UTC. | Test unitaire de libération anticipée, test navigateur réservation à J+8 ; cycle normal à J. |
| Q03 — Confirmation insuffisamment validée | Dates ISO strictes, ordre et absence de passé, capacité, publication et vérification active relus dans la transaction finale. Réservation des lignes OPEN existantes et gestion des conflits concurrents. | Tests des actions modifiées après l’OTP ; tests des dates et des reprises de transactions ; parcours réservation. |
| Q04 — Webhook partiellement traité | Événement, statuts, calendrier, commission et audit dans une transaction ; sérialisation par paiement ; rejeu idempotent. | Échec volontaire tardif sur commission : rollback des statuts, du calendrier, de l’audit et de l’événement, puis deux rejeux simultanés et une seule commission. |
| Q05 — Dernier jour et concurrence du calendrier | Écritures conditionnées au statut courant OPEN/BLOCKED, sans lecture périmée et sans exclusion du dernier jour. | Formulaire volontairement modifié sur J+59, conservant successivement HELD et BOOKED ; parcours normal calendrier. |
| Q06 — Galerie et bouton trop bas | Grille de ratios réguliers, largeur bureau limitée ; titre, prix et unique lien Réserver avant la galerie. | Captures 360/1440 px et bouton entièrement dans les 900 premiers pixels. |
| Q07 — Filtres perdus | Quartier, dates, voyageurs et budget conservés dans les liens recherche → fiche → réservation et retour ; formulaire prérempli. | Test navigateur des dates et voyageurs préremplis. |
| Q08 — Dates incohérentes silencieuses | Message de validation, aucun résultat présenté comme disponible pour des filtres invalides. Budget zéro pris en compte. | Recherche inversée rejetée dans le navigateur ; tests de validation des dates. |
| Q09 — Accessibilité | Repère main unique, lien d’évitement, liens sans boutons imbriqués, erreurs liées aux champs et annoncées. | Tests DOM des pages publiques et tests du composant Field. |

Les tests terrain et validation administrative créent maintenant leurs propres fiches et utilisateurs, puis les nettoient : visite hors connexion, approbation et refus passent sans réinitialiser les données de démonstration. Le démarrage local utilise le serveur standalone avec ses ressources statiques, ce qui supprime l’avertissement de configuration constaté pendant l’audit.

## Captures après correction

- Fiche : [mobile 360 px](apres-corrections/fiche-360.png), [bureau 1440 px](apres-corrections/fiche-1440.png).
- Recherche : [mobile](apres-corrections/recherche-360.png), [bureau](apres-corrections/recherche-1440.png).
- Récupération : [mobile](apres-corrections/reprise-360.png), [bureau](apres-corrections/reprise-1440.png).
- Accueil : [mobile](apres-corrections/accueil-360.png), [bureau](apres-corrections/accueil-1440.png).

Aucun débordement horizontal ni bouton imbriqué dans un lien sur les écrans contrôlés. Les motifs colorés sont les images de démonstration existantes. La carte externe n’est pas validée par ces captures.

## Données et mise en service

La migration additive `20260914193000_guest_access_otp` a été appliquée à la base locale. Pour une autre instance, appliquer `npx prisma migrate deploy` et `npx prisma generate` avant de démarrer le code. Aucun seed destructif exécuté ; aucune mise en production effectuée.

Le code voyageur est envoyé au téléphone uniquement : l’email librement saisi reste un contact facultatif et ne permet pas de prouver la propriété du téléphone. Les anciennes sessions voyageur doivent repasser par la récupération SMS. Voir la [décision 0015](../../agile/decisions/0015-recuperation-reservations-et-integrite.md) pour les règles et leur justification.

Les paiements et SMS restent simulés pendant la recette. Le test de rollback provoque volontairement une erreur HTTP 500 et une contrainte de commission dans les logs ; il vérifie ensuite le rétablissement. Les tests physiques Android, Safari/Firefox, réseau mobile réel et l’audit complet au lecteur d’écran restent hors de cette validation locale.
