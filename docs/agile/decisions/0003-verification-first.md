# 0003 — La vérification d'abord

**Statut** : actée avec vous à la planification du Sprint 0.

## Décision

Construire dans cet ordre : application terrain de l'agent (S1) → back-office
et mention « Vérifié » (S2) → recherche publique (S3) → espace propriétaire
(S4) → réservation (S5) → paiement (S6) → litiges et recette (S7). Le
voyageur et le propriétaire arrivent après le mécanisme de vérification, pas
avant.

## Pourquoi

Le CDC le dit lui-même en §2 : « La vérification est le produit, la
plateforme est son prolongement. » Sans fiches réellement vérifiées à
afficher, une recherche publique ou un tunnel de réservation construits en
premier n'auraient que des données factices à montrer — une démo qui
convainc moins qu'une vérification réelle, chronométrée, qui remonte
jusqu'au back-office.

## Conséquence assumée

Aucune surface voyageur n'est démontrable avant la fin du Sprint 3 (~7
semaines). Le jeu de données de démonstration du Sprint 0
(`prisma/seed.ts`) comble ce manque pour les revues intermédiaires en
pré-remplissant des biens déjà vérifiés.
