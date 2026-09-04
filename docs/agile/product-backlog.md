# Backlog produit — Séjours (VD Technologies)

Référence unique du backlog. Réordonné à chaque planification. Estimations en
points (Fibonacci : 1, 2, 3, 5, 8) — un ordre de grandeur d'effort, pas une
promesse de durée. Chaque story cite l'article du CDC dont elle découle.

Légende statut : ✅ Fait · 🔜 Prochain sprint · ⬜ À planifier

---

## Épic 0 — Socle technique

*Sprint S0. Aucune valeur visible du voyageur, mais tout le reste en dépend.*

| # | Story | Pts | Statut |
|---|---|---|---|
| 0.1 | En tant qu'équipe, disposer d'un dépôt Next.js + TypeScript + Tailwind, lint, CI | 3 | ✅ |
| 0.2 | Schéma Prisma complet du domaine (§4, §6, §7, §8) + migration initiale | 5 | ✅ |
| 0.3 | Jeu de données de démonstration (seed) | 2 | ✅ |
| 0.4 | Authentification téléphone + OTP partagée par les 4 surfaces (§3) | 5 | ✅ |
| 0.5 | i18n FR/EN dès le socle (§2), sélecteur de langue | 3 | ✅ |
| 0.6 | Design system minimal : jetons, Button/Field/Card, badge Vérifié | 3 | ✅ |
| 0.7 | Pipeline de compression d'image côté client (§7.1, §7.3) | 3 | ✅ |
| 0.8 | docker-compose (Postgres + MinIO), `.env.example` | 2 | ✅ |
| 0.9 | Port de paiement abstrait + simulateur Mobile Money (§8, §12) | 5 | ✅ |
| 0.10 | Machine à états de réservation centralisée (§7.2) | 3 | ✅ |

---

## Épic 1 — Application terrain de l'agent

*Sprint S1. Objectif de démo : un agent réalise une visite complète hors
connexion et elle remonte au serveur.*

| # | Story | Pts | Statut |
|---|---|---|---|
| 1.1 | Connexion agent (réutilise §0.4, purpose `AGENT_LOGIN`) | 1 | ✅ |
| 1.2 | Liste des visites affectées à l'agent (§6.4.1) | 2 | ✅ |
| 1.3 | Stockage local (IndexedDB/Dexie) de la visite en cours, hors connexion | 5 | ✅ |
| 1.4 | Prise de vue guidée par liste imposée : façade, entrée, pièces, sanitaires, cuisine, vue, accès (§4.1.4) | 5 | ✅ |
| 1.5 | Horodatage + géolocalisation à l'ouverture de la visite (§4.1.3) | 2 | ✅ |
| 1.6 | Formulaire d'inventaire des équipements, écarts annoncé/constaté (§4.1.5) | 3 | ✅ |
| 1.7 | Saisie des points de repère d'accès (§4.1.6) | 1 | ✅ |
| 1.8 | Vérification pièce d'identité + titre à louer du propriétaire (§4.1.7) | 2 | ✅ |
| 1.9 | Synchronisation différée (Background Sync) vers le stockage objet + API | 5 | ✅ |
| 1.10 | Chronométrage automatique en test e2e : visite complète < 45 min (§11.1) | 3 | ✅ |

---

## Épic 2 — Back-office et mention « Vérifié »

*Sprint S2. Objectif de démo : un admin valide une fiche, la mention est
attribuée et expire à 12 mois.*

| # | Story | Pts | Statut |
|---|---|---|---|
| 2.1 | Connexion admin (purpose `ADMIN_LOGIN`) | 1 | ✅ |
| 2.2 | File des fiches en attente de validation | 3 | ✅ |
| 2.3 | Validation / refus d'une fiche, attribution de la mention (§4.1.8) | 3 | ✅ |
| 2.4 | TODO-JURIDIQUE : formulation de l'attestation validée par un conseil (§4.2, §10.1) — **point ouvert §12, à faire trancher avec vous** | 1 | ✅ |
| 2.5 | Tâche planifiée d'expiration à 12 mois + relance de renouvellement (§6.5) | 3 | ✅ |
| 2.6 | Publication automatique de la fiche sous 24h après visite (§11.2) | 2 | ✅ |
| 2.7 | Planification d'une visite : affectation d'un agent à une demande (§4.1.2) | 2 | ✅ |

*Story 2.7 ajoutée au Sprint 4 : trou du backlog original — sans elle, une
demande de vérification (épic 4) n'avait jamais de suite. Voir
`docs/agile/sprints/sprint-04.md`.*

---

## Épic 3 — Recherche et consultation publique

*Sprint S3. Objectif de démo : un voyageur recherche et ouvre une fiche
vérifiée, budget de poids tenu.*

| # | Story | Pts | Statut |
|---|---|---|---|
| 3.1 | Recherche par quartier, dates, budget, nombre de personnes (§6.1.1) | 5 | ✅ |
| 3.2 | Liste de résultats optimisée mobile/réseau lent (§6.1.2) | 3 | ✅ |
| 3.3 | Fiche détaillée : photos, équipements, date + agent de vérification (§6.1.3) | 3 | ✅ |
| 3.4 | Carte de situation approximative + repères textuels (§6.1.4) | 2 | ✅ |
| 3.5 | Masquage des coordonnées propriétaire avant réservation confirmée (§6.1.5) | 1 | ✅ |
| 3.6 | Lighthouse CI : budget Ko/fiche en échec bloquant (§7.3) | 3 | ✅ |

---

## Épic 4 — Espace propriétaire

*Sprint S4. Objectif de démo : un propriétaire demande une vérification et
tient son calendrier.*

| # | Story | Pts | Statut |
|---|---|---|---|
| 4.1 | Demande de vérification + suivi de traitement (§6.3.1) | 3 | ✅ |
| 4.2 | Fiche de bien : prix/description modifiables, reste en lecture seule (§6.3.2) | 3 | ✅ |
| 4.3 | Calendrier de disponibilité (§6.3.3) | 5 | ✅ |
| 4.4 | Liste des réservations et statuts (§6.3.4) | 2 | ✅ |
| 4.5 | Historique des règlements et commissions (§6.3.5) | 2 | ✅ |

---

## Épic 5 — Réservation

*Sprint S5. Objectif de démo : réservation bout en bout jusqu'à
« Acceptée », verrou de calendrier tenu.*

| # | Story | Pts | Statut |
|---|---|---|---|
| 5.1 | Sélection de dates avec disponibilité temps réel (§6.2.1) | 5 | 🔜 |
| 5.2 | Verrouillage du calendrier à la demande, expiration si non-paiement (§7.3) | 3 | 🔜 |
| 5.3 | Identification voyageur par OTP au moment de réserver, sans compte (§6.2.2) | 2 | 🔜 |
| 5.4 | Acceptation / refus de la demande par le propriétaire | 2 | 🔜 |
| 5.5 | Réservation < 3 min sur Android d'entrée de gamme (§11.3) — mesure e2e | 3 | 🔜 |

---

## Épic 6 — Paiement

*Sprint S6. Objectif de démo : cycle complet payé → arrivée → libération →
commission sur le simulateur. **Point ouvert §12 à trancher avec vous avant
ce sprint** : déclencheur de libération, politique d'annulation, répartition
de la commission (voir plan — table des points à trancher).*

| # | Story | Pts | Statut |
|---|---|---|---|
| 6.1 | Création d'intention de paiement à l'acceptation (§8.1) | 2 | ⬜ |
| 6.2 | Redirection vers l'établissement de paiement (§6.2.3) | 2 | ⬜ |
| 6.3 | Webhook entrant vérifié + idempotent (§8.4) | 3 | ⬜ |
| 6.4 | Confirmation d'arrivée par le voyageur → ordre de libération (§5.1.7, §8.6) | 3 | ⬜ |
| 6.5 | Annulation + remboursement selon conditions paramétrables (§6.2.6, §8.7) | 3 | ⬜ |
| 6.6 | Journal des commissions et rapprochement (§6.5.4, §8.8) | 3 | ⬜ |
| 6.7 | Story de branchement du PSP réel (dès le §12 tranché) | 3 | ⬜ |

---

## Épic 7 — Litiges et recette finale

*Sprint S7. Objectif de démo : les 5 critères d'acceptation du CDC §11
rejoués et consignés.*

| # | Story | Pts | Statut |
|---|---|---|---|
| 7.1 | Signalement d'écart par le voyageur (§4.2 dernier point) | 2 | ⬜ |
| 7.2 | Déclenchement d'une contre-visite | 2 | ⬜ |
| 7.3 | Retrait de mention suite à contre-visite défavorable | 2 | ⬜ |
| 7.4 | Traitement des litiges au back-office (§6.5.3) | 3 | ⬜ |
| 7.5 | Recette des 5 critères du §11, consignée dans `docs/agile/recette-v1.md` | 5 | ⬜ |
| 7.6 | 50 réservations réelles sans intervention manuelle (§11.5) — jalon post-launch | — | ⬜ |

---

## Hors périmètre v1 (CDC §9)

Rappel : hôtels, transferts/excursions/véhicules, application native, avis
et notation, messagerie intégrée, tarification dynamique, multi-devises et
carte, fidélité. Toute story qui y ressemble est refusée en planification,
sauf décision explicite contraire.
