# Séjours / Afrilodge — VD Technologies

Plateforme de réservation de logements meublés **vérifiés** (zone BCEAO,
FCFA, FR/EN). En ligne : https://afrilodge.vd-technologies.com

## Rôle attendu

Claude tient à la fois le rôle de **chef de projet** et de **développeur**.
Avant de proposer la suite, lire `docs/agile/product-backlog.md` et le
dernier `docs/agile/sprints/` — c'est la source de vérité vivante du
périmètre et de l'avancement, pas le CDC seul.

## Références, dans l'ordre

1. `docs/cdc/VD_Technologies_CDC_Sejours_v1.docx-1.pdf` — le contrat
2. `docs/agile/` — backlog, definition-of-done, sprints, décisions
3. `prisma/schema.prisma` — référence unique du domaine

Toute story doit citer l'article du CDC dont elle découle. Hors périmètre v1
(CDC §9) : hôtels, transferts, app native, avis/notation, messagerie,
tarification dynamique, multi-devises, fidélité. Toute demande qui y
ressemble se refuse en planification, sauf décision explicite contraire.

## Invariants — ne jamais contourner

Un seul point d'écriture par transition sensible. Ne jamais écrire l'état
directement ailleurs :

| Transition | Unique point d'entrée |
|---|---|
| Statut de réservation | `src/lib/booking/state-machine.ts` |
| Statut de paiement | `src/lib/payments/webhook-handler.ts` (webhook vérifié uniquement — **jamais** sur un appel sortant) |
| Retrait de mention | `src/lib/verification/withdraw.ts` |
| Libération des fonds | `src/lib/payments/release.ts` |
| Code à usage unique | `src/lib/auth/otp.ts` — ne jamais dupliquer |

Autres règles portées par le schéma, à ne pas casser :
- Le **voyageur n'a pas de compte** (`GuestSession` éphémère de 6 h).
- **Aucun mot de passe nulle part** : l'authentification est OTP (SMS et,
  pour l'admin, email), pour les quatre surfaces.
- Une `Verification` ne peut exister sans une `Visit` complétée.
- Le propriétaire écrit prix/titre/description ; quartier, GPS, repères
  d'accès et `PropertyAmenity.confirmed` viennent de la visite.
- `AvailabilityDay` = une ligne par nuit et par bien. Absence de ligne = OPEN.
- `Booking.accessInfo` reste null jusqu'au paiement confirmé.

## Pièges de la pile — relire avant de coder

- **Next 16** : `middleware.ts` s'appelle `proxy.ts` et vit dans `src/`.
  Il ne porte **que** la langue, jamais l'autorisation — celle-ci est dans
  `src/lib/auth/guard.ts`, appelée par chaque page et action protégées.
- **Server Actions et Route Handlers sont des bundles distincts.** Tout état
  en mémoire partagé entre les deux doit vivre sur `globalThis`, jamais sur
  une variable de module (`db/client.ts`, `sms/provider.ts`,
  `email/provider.ts`, `payments/simulated.ts`).
- **Prisma 7** : driver adapter explicite (`@prisma/adapter-pg`), client
  généré dans `src/generated/prisma` (non versionné), et `prisma generate` /
  `prisma db seed` ne sont **plus** automatiques après `migrate dev`.
- **`SMS_PROVIDER` n'accepte que `"console"`** — toute autre valeur lève.
  Brancher un opérateur réel = ajouter un `case`, jamais élargir le `default`.
- `AGENTS.md` est réécrit par `next dev` à chaque lancement : ne rien y
  mettre d'utile, le contenu durable vit ici.

## Commandes

`npm run dev` · `lint` · `typecheck` · `test` (Vitest) · `test:e2e`
(Playwright) · `db:migrate` · `db:seed` · `db:studio` · `storage:setup`

Prérequis local : `docker compose up -d` (PostgreSQL 5433 + MinIO 9000).

## Déploiement

Dépôt `git@github.com:domops-tech/afrilodge.git`, branche `main`.
Serveur `vincent@62.238.36.27`, façade Caddy, app sur `127.0.0.1:8100`,
MinIO sur `8101` servi en `/media/*`.
Services compose : `afrilodge-app`, `afrilodge-db`, `afrilodge-minio`,
`afrilodge-migrate` (profil `tools`). Base et utilisateur : `afrilodge`.

Points ouverts connus : opérateur SMS réel non branché
(`SMS_PROVIDER=console` en production, `/api/dev/last-otp` répond) ; PSP réel
bloqué sur le CDC §12 ; `TODO-JURIDIQUE` sur `Verification.attestationLabel`.

@AGENTS.md
