# Diagramme de cas d'utilisation — Ayostay (v1)

Périmètre : CDC v1, backlog `docs/agile/product-backlog.md` (épics 0 à 7).
Source PlantUML éditable : [`cas-utilisation.puml`](cas-utilisation.puml).
Les éléments hors périmètre (CDC §9 : avis, messagerie, hôtels, app native…) n'apparaissent pas.

## Acteurs

| Acteur | Rôle | Authentification |
|---|---|---|
| Voyageur | Recherche, réserve, paie, confirme son arrivée, signale un écart | Aucun compte : session éphémère de 6 h, OTP au moment de réserver |
| Propriétaire | Fait vérifier ses biens, tient son calendrier, accepte les demandes | Téléphone ou email + OTP (`/connexion`) |
| Agent terrain | Réalise les visites de vérification, y compris hors connexion | Téléphone ou email + OTP (`/terrain/connexion`), compte créé par l'admin |
| Administrateur | Valide les fiches, planifie les visites, traite les litiges | Téléphone ou email + OTP (`/admin/connexion`) |
| Planificateur (cron) | Déclenche les traitements périodiques | Secret `CRON_SECRET` / scripts |
| PSP / Mobile Money | Exécute les paiements, appelle le webhook | Simulateur tant que le CDC §12 n'est pas tranché |
| Fournisseur SMS / Email | Livre les codes OTP et relances | `SMS_PROVIDER=console` en production aujourd'hui |

## Diagramme

```mermaid
flowchart LR
  V([Voyageur<br/>sans compte])
  P([Propriétaire])
  A([Agent terrain])
  ADM([Administrateur])
  CRON([Planificateur cron])
  PSP([PSP Mobile Money])
  MSG([SMS / Email])

  subgraph Plateforme["Plateforme Ayostay"]
    direction LR

    subgraph PUB["Recherche publique"]
      S1(Rechercher un logement)
      S2(Consulter une fiche vérifiée)
      S3(Voir situation approximative)
    end

    subgraph RES["Réservation et paiement"]
      R1(Choisir des dates)
      R2(S'identifier par OTP)
      R3(Demander une réservation)
      R4(Payer via Mobile Money)
      R5(Confirmer son arrivée)
      R6(Annuler et être remboursé)
      R7(Retrouver ses réservations)
      R8(Signaler un écart)
    end

    subgraph OWN["Espace propriétaire"]
      O1(Demander une vérification)
      O2(Modifier prix et description)
      O3(Gérer le calendrier)
      O4(Accepter ou refuser une demande)
      O5(Consulter réservations)
      O6(Consulter règlements et commissions)
      O7(Renouveler une vérification)
    end

    subgraph FLD["Application terrain"]
      F1(Consulter ses visites)
      F2(Réaliser une visite hors connexion)
      F3(Photos guidées)
      F4(Inventaire des équipements)
      F5(Repères d'accès)
      F6(Vérifier identité et titre)
      F7(Synchroniser la visite)
    end

    subgraph BO["Back-office"]
      B1(Planifier une visite)
      B2(Créer un compte agent)
      B3(Valider ou refuser une fiche)
      B4(Traiter un litige)
      B5(Déclencher une contre-visite)
      B6(Retirer une mention)
      B7(Suivre commissions)
      B8(Paramétrer annulation et commission)
    end

    LOGIN(Se connecter par OTP)

    subgraph AUTO["Traitements automatiques"]
      T1(Expirer verrous impayés)
      T2(Expirer mentions et relancer)
      T3(Libérer les fonds après 24 h)
      T4(Recevoir le webhook de paiement)
      T5(Publier la fiche sous 24 h)
    end
  end

  V --- S1 & S2 & R3 & R4 & R5 & R6 & R7 & R8
  S2 -.->|include| S3
  R3 -.->|include| R1
  R3 -.->|include| R2
  R7 -.->|include| R2

  P --- LOGIN & O1 & O2 & O3 & O4 & O5 & O6 & O7
  O7 -.->|extend| O1

  A --- LOGIN & F1 & F2
  F2 -.->|include| F3 & F4 & F5 & F6 & F7

  ADM --- LOGIN & B1 & B2 & B3 & B4 & B7 & B8
  B4 -.->|extend| B5
  B5 -.->|extend| B6
  B3 -.->|include| T5

  CRON --- T1 & T2 & T3
  PSP --- T4
  R4 -.-> PSP
  T3 -.-> PSP
  R6 -.-> PSP
  LOGIN -.-> MSG
  R2 -.-> MSG
  T2 -.-> MSG
```

## Description des cas d'utilisation principaux

| Cas | Acteur | Pré-condition | Résultat | CDC |
|---|---|---|---|---|
| Rechercher un logement | Voyageur | Aucune | Liste de biens vérifiés filtrée, légère pour réseau lent | §6.1.1–2 |
| Demander une réservation | Voyageur | Bien vérifié, dates libres, OTP validé | Réservation en attente, jours verrouillés jusqu'au paiement | §6.2, §7.3 |
| Accepter une demande | Propriétaire | Demande en attente | Intention de paiement créée | §6.3.4, §8.1 |
| Payer | Voyageur | Demande acceptée | Paiement confirmé par webhook vérifié ; infos d'accès débloquées | §6.2.3, §8.4 |
| Confirmer son arrivée | Voyageur | Paiement confirmé | Ordre de libération des fonds et commission | §5.1.7, §8.6 |
| Réaliser une visite | Agent | Visite affectée | Fiche de visite complète (< 45 min), synchronisée au serveur | §4.1, §11.1 |
| Valider une fiche | Administrateur | Visite complétée | Mention « Vérifié » (12 mois), fiche publiée sous 24 h | §4.1.8, §11.2 |
| Signaler un écart | Voyageur | Séjour en cours | Litige ouvert, contre-visite possible, retrait de mention éventuel | §4.2, §6.5.3 |

## Règles métier à retenir

- Un bien n'est publié qu'avec une `Verification`, qui exige une `Visit` complétée.
- Le propriétaire écrit prix, titre et description ; quartier, GPS, repères et équipements confirmés viennent de la visite.
- Les coordonnées et `accessInfo` restent masquées tant que le paiement n'est pas confirmé.
- Le statut de paiement ne change que sur webhook vérifié.
