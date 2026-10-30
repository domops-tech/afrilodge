# AyoStay — état des lieux du projet (30 octobre 2026)

Document de compréhension : ce qu'est le produit, ce qui est fait, ce qui manque, et la direction proposée. Établi à partir du code, du backlog, de la recette et de la charte `AyoStay-charte/`. Ce qui n'a pas été vérifié est signalé.

## 1. Le produit en trois phrases

AyoStay est un site de réservation de logements meublés en Afrique de l'Ouest. Sa particularité : **chaque logement est visité par un agent de l'équipe avant d'être publié**, et la fiche affiche la date de cette visite. Le voyageur réserve sans créer de compte, paie par Mobile Money, et l'argent n'est versé au propriétaire qu'une fois l'arrivée confirmée.

Le problème résolu : on réserve souvent un logement à distance sans savoir si les photos et les équipements annoncés sont vrais. AyoStay remplace la promesse du propriétaire par un constat daté.

## 2. Les quatre personnes qui utilisent le site

| Qui | Ce qu'il fait | Où |
|---|---|---|
| **Voyageur** | Cherche un logement, voit la fiche vérifiée, demande des dates, reçoit un code par SMS, paie, confirme son arrivée. Aucun compte, aucun mot de passe. | Pages publiques et `/reserver` |
| **Propriétaire** | Crée son bien, demande une vérification, fixe son prix, tient son calendrier, accepte ou refuse les demandes, suit ses règlements. | `/proprietaire` |
| **Agent terrain** | Visite le logement avec son téléphone, **même sans internet** : photos imposées (façade, entrée, pièces, sanitaires, cuisine, vue, accès), inventaire des équipements, repères d'accès, vérification d'identité du propriétaire. Tout se synchronise au retour du réseau. | `/terrain` |
| **Administrateur** | Planifie les visites, crée les agents, valide ou refuse les fiches, traite les litiges, suit les commissions, règle la politique d'annulation. | `/admin` |

## 3. Le parcours complet, raconté

1. Un propriétaire inscrit son logement et demande une vérification.
2. L'administrateur affecte un agent. L'agent fait la visite, hors connexion si besoin.
3. L'administrateur relit la visite et valide : le logement est publié avec la mention « vérifié sur place » et la date. La mention dure 12 mois, puis le propriétaire est relancé pour la renouveler.
4. Un voyageur trouve le logement, choisit ses dates, confirme son numéro par un code SMS. Les nuits sont bloquées le temps qu'il paie.
5. Le propriétaire accepte. Le voyageur paie. Les coordonnées d'accès ne lui sont révélées **qu'à ce moment**.
6. À l'arrivée, le voyageur confirme. Les fonds sont libérés au propriétaire et la plateforme prélève sa commission. Sans confirmation, la libération se fait automatiquement 24 h après.
7. Si le logement ne correspond pas à la fiche, le voyageur signale l'écart. L'administrateur peut envoyer un agent en contre-visite et **retirer la mention**.

## 4. Où nous en sommes

### Construit et testé
Toutes les fonctions décrites ci-dessus existent dans le code : recherche, fiche, réservation, paiement, visite terrain hors connexion, validation, expiration à 12 mois, litiges, commissions, FR/EN. Le backlog affiche tout comme terminé, sauf deux lignes (voir 4.2). Les tests unitaires passent (71) et le dernier sprint annonce 22 tests de bout en bout.

### Simulé : fonctionne, mais pas pour de vrai
| Élément | Réalité aujourd'hui |
|---|---|
| **Paiement Mobile Money** | Simulateur. Le bouton « Payer » ne débite personne. Le vrai opérateur dépend d'une décision juridique non tranchée (CDC §12). |
| **SMS** | Les codes ne sont pas envoyés : ils s'affichent dans les journaux du serveur. Aucun vrai opérateur SMS n'est branché. |
| **Photos des logements** | Images de démonstration. Aucun vrai logement n'a encore été visité et publié. |
| **Formulation juridique de la mention** | Texte provisoire, marqué `TODO-JURIDIQUE`. À faire valider par un juriste. |

### Pas encore fait
- Branchement du vrai paiement (story 6.7).
- Le jalon « 50 réservations réelles sans intervention manuelle » (7.6), qui ne peut venir qu'après le lancement.
- Le chronométrage humain réel des critères « visite en moins de 45 min » et « réservation en moins de 3 min » : les tests automatiques prouvent le mécanisme, pas l'usage réel.

## 5. Deux alertes à traiter avant toute présentation publique

**Sécurité (corrigée dans le code, à déployer).** La route `/api/dev/last-otp` renvoyait le dernier code de connexion d'un numéro ou d'un email, et n'était protégée que par `SMS_PROVIDER=console`, réglage actif en production d'après `CLAUDE.md`. Elle exige désormais aussi `ENABLE_DEV_OTP_ENDPOINT=1`, que seuls les tests de bout en bout posent. Tant que cette version n'est pas déployée, le serveur en ligne reste exposé ; je n'ai pas interrogé le serveur pour le confirmer. Conséquence : en production, sans vrai opérateur SMS, les codes ne se lisent plus que dans les journaux du serveur.

**Marché visé : le Bénin (décision du 30 octobre).** Le texte de recherche cite des quartiers béninois, ce qui est cohérent, mais les comptes de démonstration, le seed et les indicatifs sont ivoiriens (+225, Plateau, Bingerville, Yopougon) et doivent être alignés. Le texte de recherche cite Cotonou, Fidjrossè, Haie Vive (Bénin), alors que les comptes de démonstration sont ivoiriens (+225, Plateau, Bingerville, Yopougon). La charte dit « Afrique de l'Ouest » sans choisir. Il faut décider du marché de lancement : cela commande les textes, les photos, le paiement et le vocabulaire.

## 6. La charte AyoStay n'est pas encore dans le site

La charte (`AyoStay-charte/`) est complète sur le papier : couleurs, typographie Outfit, logos, badge, ton de voix. Dans le code, rien n'est appliqué :

| Sujet | Charte | Site actuel |
|---|---|---|
| Police | Outfit | Geist |
| Couleur de la confiance | Indigo `#2C4778` | Vert `#234e3b` |
| Couleur principale | Terracotta `#D9622B` / foncé `#B4471A` | `#b45137` (proche, pas identique) |
| Fond | Chaux `#FBF8F3` | `#faf9f6` |
| Logo, badge, favicon | Fournis | Aucun (`public/` est vide) |
| Motif de la porte (coins arrondis) | Défini | Absent |
| Slogan | « Chez vous, où que vous soyez » | « Un logement meublé, vérifié sur place » |

Le nom a été changé dans les textes, mais pas encore l'identité visuelle.

## 7. Direction proposée

1. **Sécuriser** : fermer la faille des codes de connexion, sans casser les tests de bout en bout.
2. **Appliquer la charte** : remplacer les couleurs, la police et les rayons par les jetons de la charte, intégrer logo, badge et favicon.
3. **Refondre les écrans clés** : accueil, recherche, fiche logement, réservation. Écrire les textes avec le ton de la charte, pour que le site ait une voix et non un gabarit.
4. **Rendre le produit réel** : choisir le marché de lancement, brancher un opérateur SMS, trancher le paiement avec un juriste, visiter et photographier quelques vrais logements.
5. **Recette finale** puis migration du domaine vers AyoStay.

Les étapes 1 et 2 sont de mon ressort immédiat. L'étape 4 dépend de décisions qui sont les vôtres.

## 8. Comment l'expliquer à un utilisateur

> « Sur AyoStay, chaque logement a été visité par notre équipe, qui a vérifié les photos et les équipements sur place. Vous voyez la date de la visite. Vous réservez sans créer de compte, vous payez par Mobile Money, et le propriétaire n'est payé qu'une fois que vous êtes bien arrivé. »
