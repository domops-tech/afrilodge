# 0016 — Connexion unifiée téléphone/email et correction d'une confusion de rôle

Demandé le 15 septembre 2026 : simplifier les quatre pages de connexion en
un seul champ (téléphone ou email, détecté côté serveur) plutôt qu'un champ
dédié par canal — l'admin en portait deux formulaires distincts depuis
l'ajout de la connexion email (0015bis, même jour). Périmètre : les trois
surfaces à compte (propriétaire, agent, admin). Le voyageur garde son
propre champ téléphone dans `BookingWizard.tsx` — CDC §6.2.2 l'impose,
hors périmètre ici.

## Décision

`src/lib/auth/login-flow.ts` détecte l'identifiant saisi (présence d'un
`@`) et route vers le bon canal — SMS pour un téléphone, email pour un
email — sans dupliquer la logique de demande/vérification de code. Les
formulaires dédiés (`EmailOtpLoginForm`, les actions
`requestAdminEmailOtpAction`/`verifyAdminEmailOtpAction`) sont retirés :
`OtpLoginForm` seul, réutilisé par les trois surfaces comme avant le 15/09.

**Auto-inscription** : jamais possible par email, pour aucun rôle — le
schéma exige un `User.phone`, qu'un email seul ne fournit pas. Seul le
téléphone peut créer un compte, et seulement pour le propriétaire (§5.2.16).
Un identifiant email pour un compte inconnu renvoie le même message
générique qu'un téléphone inconnu (anti-énumération, déjà le principe de
la connexion email admin d'origine).

`OtpPurpose.ADMIN_EMAIL_LOGIN` reste dans l'énumération (retirer une valeur
d'enum Postgres proprement demande une migration disproportionnée pour un
gain nul) mais n'est plus utilisée par le nouveau code : les trois canaux
email passent par `OWNER_LOGIN`/`AGENT_LOGIN`/`ADMIN_LOGIN`, exactement
comme leur pendant téléphone.

## Bug corrigé en construisant cette unification

`requestLoginOtp`/`verifyLoginOtp` ne vérifiaient le rôle d'un compte
existant que lorsque l'auto-inscription était refusée (agent, admin). Pour
le propriétaire (auto-inscription autorisée), un compte déjà enregistré
sous un AUTRE rôle n'était jamais écarté : un agent qui se connectait sur
`/connexion` avec son propre téléphone obtenait une session marquée
`role: "OWNER"` pointant vers son identifiant agent — `requireRole` fait
confiance au rôle du cookie signé, sans le revérifier en base à chaque
requête. Corrigé une fois pour toutes : un compte trouvé sous un rôle
différent de la page visitée est désormais traité comme non reconnu, quel
que soit le canal ou la politique d'auto-inscription. Voir le commentaire
d'en-tête de `login-flow.ts`.

## Corrigé au passage : déconnexion

`logoutAction` renvoyait systématiquement vers `/`, y compris pour un
agent ou un admin — constaté en usage réel : après déconnexion, l'espace
agent redevenait indiscernable de l'accueil public, sans moyen visible de
se reconnecter. Renvoie désormais vers la page de connexion du rôle qui
vient de se déconnecter (`LOGIN_PATH_BY_ROLE`, déjà utilisée par
`requireRole`), `/` restant la destination pour le voyageur (pas de page
de connexion dédiée).

## Confort ajouté : nom mémorisé localement

Le champ « nom complet » (première connexion propriétaire) est mémorisé
dans le stockage local du navigateur pour ne pas le retaper à chaque
connexion sur le même appareil. Volontairement **jamais** pré-rempli
depuis le serveur ni conditionné à l'existence d'un compte : afficher ce
champ seulement pour un compte inconnu, avant même la vérification du
code, permettrait d'énumérer les numéros déjà enregistrés en observant sa
simple présence. Le champ reste donc affiché systématiquement pour tout
identifiant en forme de téléphone (masqué seulement pour un identifiant en
forme d'email, qui ne peut de toute façon jamais créer de compte) ; seule
sa valeur initiale change.

## Déploiement

Aucune migration. `/api/dev/last-otp` (réservé au développement et aux
tests, gardé par `SMS_PROVIDER="console"`) cherche désormais aussi dans le
cache du fournisseur email console, pour couvrir la branche email en test
de bout en bout — sans effet en production, où `EMAIL_PROVIDER="smtp"` ne
peuple jamais ce cache.
