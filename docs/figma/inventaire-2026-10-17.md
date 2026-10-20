# Séjours — inventaire avant reproduction Figma

Date : 17 octobre 2026. Source : routes Next.js, composants, traductions et tests du dépôt local. Cet inventaire ne vaut pas validation visuelle de tous les écrans.

Fichier Figma : https://www.figma.com/design/D1yQiR8DLj4ykZGPzIMqUP

## Avis sur la démarche

Préparer la refonte dans Figma est pertinent pour comparer les propositions et valider les parcours avant modification du code. Conserver un état actuel intact et travailler sur des copies évite de perdre la référence. Une reproduction exhaustive de toutes les combinaisons de données serait coûteuse et peu utile : distinguer les modèles de pages, leurs étapes et les états qui modifient les décisions possibles.

Les maquettes doivent être éditables, avec textes, composants et structure. Des captures seules ne permettraient pas une refonte efficace. Figma ne remplace pas les validations d'accessibilité, de responsive et de comportement dans le navigateur.

## Modèles de pages : 21 routes, hors variantes de langue

Les préfixes `/fr` et `/en` sont omis dans ce tableau. Les identifiants dynamiques représentent un modèle et non une page à dupliquer pour chaque enregistrement.

| Espace | Route | Contenu et variantes à reproduire |
|---|---|---|
| Public | `/` | Présentation, recherche rapide, sélection de logements, explication de la vérification ; sélection vide |
| Public | `/recherche` | Filtres quartier/ville, dates, voyageurs, budget ; tri, résultats, filtres actifs, zéro résultat, filtres invalides |
| Public | `/logements/[propertyId]` | Galerie, badge et dates de vérification, descriptif, équipements, repères, carte approximative, CTA de réservation ; variante mobile |
| Connexion propriétaire | `/connexion` | Identifiant téléphone/email, contact de secours selon le formulaire, code OTP, nom pour inscription, erreurs et envoi en cours |
| Voyageur | `/reserver` | Récupération téléphone puis OTP ; liste de réservations avec session, liste vide |
| Voyageur | `/reserver/[propertyId]` | Étapes dates, identité, code ; estimation, indisponibilité, capacité dépassée, OTP invalide/expiré, envoi en cours |
| Voyageur | `/reserver/confirmation/[bookingId]` | Suivi selon statut de réservation/paiement ; accès paiement, annulation, arrivée, signalement et litige |
| Voyageur | `/reserver/paiement/[bookingId]` | Paiement Mobile Money simulé et états autorisés par la réservation |
| Propriétaire | `/proprietaire` | Liste des biens, badge, tarif, création, déconnexion ; liste vide |
| Propriétaire | `/proprietaire/nouveau` | Titre, description, quartier, ville, tarif, capacité, équipements ; validation invalide |
| Propriétaire | `/proprietaire/biens/[propertyId]` | Édition ; suivi vérification demandé/planifié/visité/approuvé/rejeté et renouvellement ; équipements éditables/verrouillés ; calendrier 60 jours ; réservations accepter/refuser ; paiements et commissions |
| Terrain | `/terrain/connexion` | Identifiant puis OTP ; compte préexistant, erreurs |
| Terrain | `/terrain` | Visites affectées triées par date, déconnexion ; liste vide |
| Terrain | `/terrain/visite/[visitId]` | Introduction, photos fixes et pièces, équipements, repères, justificatifs identité/droit de louer, récapitulatif ; géolocalisation refusée, hors connexion, synchronisation en cours/échouée/réussie, visite déjà terminée |
| Administration | `/admin/connexion` | Identifiant puis OTP ; compte préexistant, erreurs |
| Administration | `/admin` | Demandes à planifier avec agent/date, fiches à valider, retard, contre-visite ; navigation agents/commissions/paramètres/litiges ; listes vides |
| Administration | `/admin/fiches/[requestId]` | Photos, équipements, repères, identité, attestation ; approbation, rejet avec motif, décision sur contre-visite, fiche déjà traitée |
| Administration | `/admin/agents` | Création nom/téléphone/email, liste des agents, erreurs et confirmation |
| Administration | `/admin/commissions` | Récapitulatif des commissions et données de paiement |
| Administration | `/admin/parametres` | Commission et délai de remboursement ; valeurs invalides et sauvegarde |
| Administration | `/admin/litiges` | Litiges ouverts, planification de contre-visite, maintien/retrait de mention avec note, résolution ; liste vide |

## Fondations identifiées dans le code

- Texte courant : Geist ; monospace : Geist Mono ; titres : Georgia, avec repli Times New Roman/serif.
- Fond : `#faf9f6` ; texte : `#222c26` ; surface : `#fffefa` ; surface secondaire : `#f1f0e9` ; bordure : `#dedfd6` ; secondaire : `#667168`.
- Accent : `#b45137` ; survol : `#963d29` ; vérification : `#234e3b` ; vérification douce : `#e7efe8` ; danger : `#a63e3e` ; succès : `#235841`.
- Rayons principaux : 16 et 24 px. Composants partagés : Button, Field, Card, PropertyCard, PropertyImage, VerifiedBadge, VerificationNote, SiteHeader, SiteFooter, OtpLoginForm.
- Ruptures responsive spécifiques : 374, 600, 767, 1280 et 1600 px, plus les utilitaires Tailwind dans les composants. Prévoir au moins des références à 390 et 1440 px, et vérifier la transition à 768 px.
- Aucun fichier Code Connect trouvé par la recherche `*.figma.*`.

## Premiers constats de cohérence

Le public et le tunnel de réservation disposent de conteneurs et de composants de présentation élaborés. Les espaces propriétaire, terrain et administration utilisent davantage de mises en page utilitaires simples avec marges fixes. Cette différence est visible dans les sources ; son impact utilisateur reste à confirmer en parcourant tous les écrans.

La gestion d'un bien rassemble édition, vérification, équipements, calendrier, réservations et paiements sur une même page. C'est un point à examiner lors de la refonte : hiérarchie, repérage des actions et longueur mobile. Le parcours terrain doit conserver ses états hors connexion et ses contraintes de capture ; une refonte purement esthétique risquerait de les masquer.

## Avancement réel et points à résoudre

- Authentification Figma et création du fichier confirmées ; lecture du fichier via Plugin API fonctionnelle.
- 21 routes inventoriées. L'accueil local répond HTTP 200 après démarrage des services PostgreSQL et MinIO.
- Mise à jour : le connecteur Opera répond désormais et l'accueil local s'ouvre dans son onglet. L'ouverture explicite de l'URL de capture dans cet onglet a débloqué l'envoi.
- Première capture confirmée : accueil, nœud `2:2`, 1798 × 2065 px, 160 frames, 61 textes et 26 vecteurs ; aucun remplissage image. Il s'agit d'une capture native brute, encore à structurer avec les composants de référence et à valider visuellement.
- Geist est disponible côté Figma ; Georgia n'a pas été trouvée dans la liste des polices retournée. La capture utilise Times New Roman pour les titres (police de repli du code). La fidélité des titres devra être vérifiée par comparaison au navigateur avant validation.
- Les écrans protégés et leurs états ne sont pas encore vérifiés visuellement. Aucune reproduction complète n'est annoncée.

## Organisation recommandée du fichier

Conserver des sections « État actuel » par espace, chacune avec bureau/mobile et les états utiles. Prévoir des fondations et composants communs, puis des sections « Propositions » distinctes. Reporter pour chaque écran la route, la langue, le rôle, les données de démonstration utilisées et le statut de vérification. Comparer chaque écran éditable au rendu réel avant de le déclarer terminé.

## Reprise après coupure — 17 octobre 2026, fin de soirée

L'état du fichier Figma est plus avancé que les notes précédentes. Le contrôle direct a retrouvé trois pages : `98 · Captures de travail` (`0:1`), `01 · État actuel` (`7:51`) et `00 · Fondations` (`7:52`). La page État actuel contenait 35 écrans à la reprise ; les captures des autres écrans étaient déjà disponibles.

- Intégration de 20 écrans supplémentaires, soit **55 écrans éditables** : 26 bureau à 1440 px et 29 mobiles à 390 px. Le fichier `ecrans-2026-10-17.json` contient leurs identifiants, dimensions, types de calques, polices et images.
- Ajouts : accueil bureau, espaces terrain et administration mobiles, paiement et cinq états de confirmation mobiles, identification de réservation, recherche vide/invalide et rejet administratif.
- Réemploi de 29 instances supplémentaires des composants Button et Input existants. Couleurs correspondantes liées aux variables de fondations existantes. Les captures sources ont été conservées comme références.
- Correction des fonds transparents sur les nouveaux écrans et de l'alignement des champs sur les écrans intégrés. Textes, hiérarchie et vecteurs restent éditables ; les images présentes dans les fiches administratives correspondent aux photos et justificatifs individuels.
- Accueil bureau : `70:1123`, paramètres mobiles : `70:428`, confirmation acceptée mobile : `70:727`. Ces trois écrans ont été inspectés visuellement ; l'accueil a été comparé à une capture du navigateur local.
- **Limite typographique confirmée :** ni Georgia ni Times New Roman ne sont disponibles dans le moteur Figma. Les titres des écrans intégrés utilisent Tinos, comme les écrans déjà intégrés avant la coupure. Cette substitution résout les débordements visibles de la capture brute, mais ne constitue pas une validation de fidélité typographique exacte.
- Le contrôle visuel n'est pas exhaustif. Les états OTP, erreurs, listes vides et étapes internes de visite doivent encore être confrontés à l'inventaire des routes. Les composants actuels couvrent boutons, champs et jours du calendrier ; les cartes et éléments de navigation restent à consolider en composants réutilisables.

### Point de reprise précis

Poursuivre la comparaison visuelle des écrans existants, puis compléter les états de parcours manquants sans dupliquer les 55 écrans. Résoudre la disponibilité des polices avant de déclarer la reproduction fidèle et terminée. Conserver les pages de captures tant que toutes les comparaisons ne sont pas effectuées.

Le serveur local a été relancé avec `npm run dev` sur `http://localhost:3000/fr`. PostgreSQL et MinIO sont démarrés. Aucun seed ni réinitialisation de données n'a été exécuté pendant cette reprise. Le script de capture Figma déjà présent dans `src/app/[locale]/layout.tsx` est conservé.

## Mise à jour du 18 octobre 2026 — contrôle demandé par l'utilisateur

Les 55 écrans initiaux ont été examinés visuellement. Corrections appliquées aux badges, placeholders, champs de date, centrage des réservations, largeur du bouton de création et délimitation des cadres. Dix-sept états supplémentaires ont été créés : **72 écrans présents dans le fichier**.

Le quota Figma Starter a ensuite bloqué les captures puis les modifications. La validation finale des corrections et des 17 ajouts est **inachevée** ; certains détails identifiés sur les ajouts doivent encore être corrigés. Ne pas présenter les 72 écrans comme validés.

Le point de reprise détaillé est désormais [rapport-controle-2026-10-18.md](rapport-controle-2026-10-18.md), avec les 55 identifiants initiaux, les 17 ajouts, les limites connues, les 96 références navigateur et le script de corrections préparé mais non exécuté. Reprendre ce rapport en priorité après une coupure, puis vérifier le rétablissement du quota avant de poursuivre les modifications Figma.
