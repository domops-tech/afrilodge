# 0013 — Fournisseur SMS (OTP et relances)

**Statut** : bloqué — analyse faite avec vous, choix du fournisseur reporté.
Voir aussi la décision 0014 : l'email est devenu un canal de secours optionnel
en complément de ce qui suit, jamais un remplacement.

## Contexte

Toute authentification (propriétaire, agent, admin, voyageur) passe par téléphone +
code à usage unique (CDC §3). Le port `SmsProvider`
(`src/lib/sms/provider.ts`) n'a qu'un adaptateur, `ConsoleSmsProvider`, qui
journalise le code au lieu de l'envoyer — voir le README, section « Démarrage ».
L'en-tête du fichier le dit depuis le début : « L'opérateur SMS réel (Twilio,
Orange, un agrégateur local…) n'est pas choisi ».

Vous avez demandé d'analyser les pistes, notamment une passerelle SMS personnelle
auto-hébergée, avant de trancher.

## Ce que le port impose déjà à tout futur adaptateur

- **Interface** (`provider.ts:7-9`) : `send({ to, body }): Promise<void>`. Une
  seule méthode, pas de statut de livraison, pas de retry, pas de limite de débit
  par fournisseur — l'implémentation réelle devra les ajouter, le port ne les
  offre pas.
- **Deux usages** : l'OTP de connexion (`src/lib/auth/otp.ts:76-79`, 6 chiffres,
  expire en 5 minutes) et une relance de renouvellement aux propriétaires
  (`scripts/expire-verifications.ts:60-85`). Aucun volume n'est chiffré dans le
  CDC ; le seul repère de recette est « 50 réservations réelles » (§11.5).
- **Garde-fou existant** : 5 tentatives de vérification, 5 demandes par 15 min et
  par (téléphone, motif) — `otp.ts:15-18`. Pas de plafond de dépense global
  au-delà de ce débit.
- **Format de numéro non normalisé** : `phoneSchema`
  (`src/lib/auth/login-flow.ts:15-17`) accepte `^\+?[0-9 ]{8,15}$`, sans indicatif
  par défaut ni forme E.164 unique — un `07…` local et un `+225 07…` passent tous
  les deux sans être ramenés à la même forme. La Côte d'Ivoire est passée à des
  numéros à **10 chiffres** en 2021 ; presque tout fournisseur réel exigera du
  E.164 propre en entrée.

## Pistes analysées

| Piste | Coût constaté | Fiabilité pour de l'auth | Verdict |
|---|---|---|---|
| **Passerelle auto-hébergée** — téléphone Android + application type [`capcom6/android-sms-gateway`](https://github.com/capcom6/android-sms-gateway), ou modem GSM + Gammu | Gratuit au-delà du forfait SIM | Faible : un opérateur qui détecte un envoi automatisé vers de nombreux destinataires bloque couramment la SIM ; l'application peut être tuée en arrière-plan par Android ; aucun accusé de réception fiable ; un seul point de panne physique (batterie, redémarrage, connectivité du lieu) | **Déconseillé pour l'OTP** — c'est le tout premier contact de confiance de l'utilisateur avec la plateforme (badge « Vérifié »). Reste envisageable comme canal secondaire non critique (ex. la relance de renouvellement) si le coût devient un vrai sujet à l'échelle. |
| **Orange Côte d'Ivoire (API directe)** | ~7,26 FCFA/SMS (~0,012 $), plafond 100 000 FCFA/jour par SIM, 5 requêtes/s ([tarifs Orange Developer](https://developer.orange.com/apis/sms-ci/pricing)) | Bonne pour les numéros Orange (42 % de parts de marché CI, 95 % de couverture réseau) ; incertaine hors réseau Orange (MTN, Moov) | Le moins cher trouvé, mais facturé via un solde Orange Money/forfait à recharger — pas une facturation SaaS classique (carte, facture) — et dépendance à un seul opérateur pour le reste du marché. |
| **Agrégateur panafricain** — ex. [Africa's Talking](https://africastalking.com/), qui liste la Côte d'Ivoire dans sa couverture SMS | Non confirmé pour la CI (tarif variable par pays, à vérifier à l'inscription — une grille par pays existe mais n'a pas pu être extraite lors de cette analyse) | Bonne a priori : multiplexe Orange/MTN/Moov via un seul point d'intégration, sandbox de test gratuite, facturation SaaS classique | Le compromis le plus raisonnable si un fournisseur unique doit couvrir tout le marché CI sans gérer un compte Orange Money. À confirmer par un essai en sandbox avant tout engagement. |
| **Twilio (global)** | ~0,24 $/SMS — **20× le tarif Orange direct** ([Twilio pricing CI](https://www.twilio.com/en-us/sms/pricing/ci)) | Enregistrement d'expéditeur alphanumérique obligatoire pour la CI, délai annoncé ~3 semaines ; identifiant numérique explicitement rejeté par le réseau MTN ([Twilio SMS guidelines CI](https://www.twilio.com/en-us/guidelines/ci/sms)) | Cher et lent à mettre en route pour ce marché précis ; à écarter sauf si l'équipe utilise déjà Twilio ailleurs et veut un seul fournisseur multi-pays. |

## Recommandation, si un choix devait être fait aujourd'hui

Un agrégateur panafricain (Africa's Talking en tête) pour l'OTP : une seule
intégration couvrant les trois opérateurs ivoiriens, facturation SaaS simple, pas
de solde opérateur à recharger. Orange direct reste une option à garder en tête si
le tarif se confirme très inférieur ET que la base d'utilisateurs se révèle
majoritairement Orange. La passerelle auto-hébergée est écartée pour l'OTP — sa
fragilité (blocage SIM, appli tuée en arrière-plan, aucun accusé de réception) est
disproportionnée pour le tout premier contact de confiance avec la plateforme —
mais reste une option à bas coût pour un canal secondaire non critique si le volume
de relances grossit.

## Ce qui reste bloquant

Le développement peut continuer avec `ConsoleSmsProvider` sans limite de temps :
rien dans le produit n'a besoin d'un vrai envoi pour avancer (même principe que la
fiche 0002 côté paiement). **Avant de brancher un fournisseur réel**, quel qu'il
soit :

1. Normaliser `phoneSchema` en E.164 (indicatif `+225` par défaut, 10 chiffres) —
   sans ça, un numéro saisi au format local ne sera pas fiable à router.
2. Publier une story de backlog dédiée (sur le modèle de la story 6.7, « branchement
   du PSP réel », qui n'a aujourd'hui aucun équivalent côté SMS).
3. Tester le fournisseur choisi en sandbox avec de vrais numéros ivoiriens des
   trois opérateurs avant toute bascule en production.

## Note technique

`getSmsProvider()` (`provider.ts:42-56`) ne tombe plus silencieusement sur
`ConsoleSmsProvider` pour une valeur de `SMS_PROVIDER` non reconnue — elle lève une
erreur explicite. Une valeur absente ou mal orthographiée en production faisait
disparaître tous les codes sans qu'aucune alerte ne se déclenche : aucun
utilisateur n'arrivait à se connecter, sans qu'aucune erreur ne le signale nulle
part. `"console"` reste la seule valeur reconnue tant qu'aucun fournisseur n'est
branché ; en ajouter un revient à ajouter un `case` à côté, jamais à élargir ce qui
tombe dans `default`.
