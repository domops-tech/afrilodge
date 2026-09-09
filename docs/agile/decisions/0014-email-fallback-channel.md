# 0014 — Email comme canal de secours optionnel pour l'OTP

**Statut** : actée avec vous après discussion (voir aussi décision 0013).

## Contexte

Discussion avec vous sur la possibilité d'imposer l'email et de faire de l'email
le canal d'envoi du code, à la place du SMS. Le CDC §2 mentionne les deux :
« Un numéro de téléphone, un mail et un code à usage unique suffisent » — mais le
produit construit jusqu'ici (décision 0001, §3, §6.2.2) n'implémente que
téléphone + SMS ; aucun email n'était collecté nulle part.

## Décision

Le téléphone reste le seul canal **obligatoire**, sans exception, pour les quatre
surfaces (CDC §3). L'email devient un canal de **secours optionnel** : quand
l'utilisateur en fournit un, le même code lui est envoyé en plus, jamais à la
place. Un échec d'envoi d'email n'empêche jamais une connexion ou une
réservation — voir `src/lib/auth/otp.ts`, `requestOtp` : l'envoi SMS est
inconditionnel, l'envoi email est encapsulé dans un `try/catch` qui se contente
de journaliser un échec.

Nouveau port `EmailProvider` (`src/lib/email/provider.ts`), calqué sur
`SmsProvider` (`send`, un simulateur console, un fournisseur réel à choisir plus
tard — même statut « bloqué » que la décision 0013, aucun ESP branché). La
fabrique reprend directement la correction de la décision 0013 : pas de repli
silencieux sur une valeur de `EMAIL_PROVIDER` inconnue.

Où l'email est collecté :
- **Propriétaire** (`/connexion`) : champ optionnel affiché dès l'étape
  téléphone (avant l'envoi du code — un email saisi après coup arriverait trop
  tard pour ce code-là). Un propriétaire déjà enregistré n'a rien à ressaisir :
  son email en base est réutilisé automatiquement d'une connexion à l'autre.
- **Agent, administrateur** : aucun champ à la connexion — leurs comptes sont
  provisionnés par VD Technologies (voir décision 0001), l'email éventuel vient
  déjà de leur fiche `User`.
- **Voyageur** (tunnel de réservation) : champ optionnel à l'étape identité, à
  côté du téléphone et du nom, stocké sur `GuestSession.email` (nouvelle colonne
  optionnelle, migration `20260909084611_guest_session_email_fallback`).

## Pourquoi ne pas remplacer le SMS par l'email

Le CDC pose deux contraintes qui pèsent directement contre un remplacement, pas
seulement contre le rendre obligatoire :
- « Tout fonctionne sur Android d'entrée de gamme en réseau dégradé » (§2) — le
  public visé consulte moins fiablement une boîte mail qu'un SMS, qui arrive
  quasi instantanément sans application ni synchronisation.
- « Le voyageur réserve sans créer de compte » (§2) — imposer un email au
  voyageur ajoute une friction que le CDC exclut explicitement pour ce parcours.

Un email envoyé pour la première fois par un domaine part aussi couramment en
spam, et sa latence de livraison est plus variable qu'un SMS — un risque réel
face à un code qui expire en 5 minutes (`otp.ts`). Rendre l'email un ajout
plutôt qu'un remplacement respecte le CDC à la lettre (téléphone + mail + code,
tous les trois) sans reproduire, côté email, le même échec silencieux qu'on
vient de corriger côté SMS (décision 0013).

## Ce qui reste bloquant

Comme pour le SMS (décision 0013), aucun fournisseur d'email réel n'est choisi :
`EMAIL_PROVIDER="console"` journalise au lieu d'envoyer, seule valeur reconnue
pour l'instant. Le choix d'un expéditeur transactionnel réel (Postmark, Resend,
AWS SES…) reste à faire avant toute mise en production du canal email — sans
urgence, puisque le SMS continue de porter seul l'obligation fonctionnelle.

## Note technique

`GuestSession.email` et `User.email` sont tous deux optionnels — aucune
migration de données n'était nécessaire pour `User`, le champ existait déjà
(non exploité jusqu'ici). Le formulaire (`OtpLoginForm.tsx`) porte
`showEmailField`, sur le même principe que `showFullName` : seul le
propriétaire l'affiche, agent/admin n'en ont pas besoin. Piège rencontré en
testant : `FormData.get("email")` renvoie `null`, pas `""`, quand le champ
n'existe pas dans le DOM (agent/admin) — `emailSchema`
(`src/lib/auth/login-flow.ts`) le normalise via `z.preprocess`, faute de quoi
`z.string().optional()` (qui n'accepte que `undefined`, pas `null`) faisait
échouer silencieusement *toute* connexion agent/admin avant l'envoi du code —
détecté par la suite e2e existante, pas en théorie.
