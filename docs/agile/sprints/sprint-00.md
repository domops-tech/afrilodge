# Sprint 0 — Socle

**Durée** : 1 semaine (cadrage). **Objectif** : dépôt, CI, schéma, auth OTP,
i18n FR/EN, design system minimal, pipeline d'image, backlog complet.

## Livré

- Dépôt Next.js 16 + TypeScript strict + Tailwind 4, ESLint propre,
  scripts `lint`/`typecheck`/`test`/`test:e2e`/`db:*`.
- `docker-compose.yml` : PostgreSQL 17 (port 5433 — le 5432 par défaut est
  occupé sur cette machine par un autre projet) + MinIO (S3-compatible).
- `prisma/schema.prisma` : modèle de données complet (comptes, OTP,
  sessions voyageur, biens, vérification, visites/photos/équipements,
  disponibilité, réservations, paiement, litiges, audit) — voir le fichier
  pour le détail, chaque table cite l'article du CDC dont elle découle.
- Migration initiale appliquée, client Prisma 7 généré avec driver adapter
  `pg`, jeu de démonstration (`prisma/seed.ts`) : 1 admin, 2 agents,
  3 propriétaires, 5 biens dont 3 vérifiés et publiés.
- Authentification téléphone + OTP (`src/lib/auth/otp.ts`,
  `src/lib/auth/session.ts`, `src/lib/auth/guard.ts`), anti-flood (5
  demandes/15 min) et anti-brute-force (5 tentatives/code).
- i18n FR/EN (`next-intl`), sélecteur de langue, `src/proxy.ts` pour la
  résolution de locale.
- Design system minimal : jetons de couleur/typo clair+sombre,
  `Button`/`Field`/`Card`, `VerifiedBadge` avec sa date d'expiration
  (`src/lib/verification/badge.ts`).
- Pipeline de compression d'image côté client
  (`src/lib/images/compress.ts`) + `PropertyImage`.
- Port de paiement abstrait + simulateur Mobile Money
  (`src/lib/payments/`), machine à états de réservation centralisée
  (`src/lib/booking/state-machine.ts`).
- Démonstration bout en bout : accueil bilingue → connexion propriétaire
  par téléphone + OTP (première connexion crée le compte, CDC §5.2.16) →
  tableau de bord listant les biens du compte avec badge « Vérifié ».
- 32 tests unitaires (Vitest) sur la machine à états, l'expiration de
  vérification, les dimensions de compression d'image et les sessions
  signées ; 3 tests de bout en bout (Playwright, profil Pixel 7) couvrant
  l'accueil bilingue et le parcours de connexion complet.
- Backlog complet (`docs/agile/product-backlog.md`), 4 fiches de décision
  d'architecture (`docs/agile/decisions/`).

## Écart avec le plan initial

Rien de retiré. Un bug réel corrigé pendant le sprint (pas anticipé dans le
plan) : l'état en mémoire partagé entre une Server Action et une Route
Handler ne l'était pas réellement, Next.js compilant chacun en bundle
séparé. Découvert par le test e2e de connexion (le code OTP renvoyait
`null`), corrigé en déplaçant l'état sur `globalThis` — voir fiche de
décision 0001, dernier point. Impact direct sur le Sprint 6 (webhooks de
paiement), noté dans la fiche 0002.

## Comment démontrer

```bash
docker compose up -d
npm run db:migrate   # si pas déjà fait
npm run db:seed
npm run dev
```

Ouvrir `http://localhost:3000` → bascule FR/EN → « Se connecter » → un des
numéros du seed (ex. `+2250700000020`, Fatou Diabaté) → le code s'affiche
dans les logs du serveur (`SMS_PROVIDER=console`) → tableau de bord avec
biens vérifiés.

`npm test` (unitaires) et `npm run test:e2e` (bout en bout, nécessite
`npx playwright install chromium` une première fois).

## Rétrospective

- **Bien** : détecter le bug de bundling Server Action / Route Handler
  *avant* le Sprint 6 (paiement), où il aurait cassé silencieusement la
  réception des webhooks en production. Le test e2e de connexion l'a
  attrapé tôt parce qu'il exerçait le même mécanisme (Server Action +
  Route Handler) pour une raison différente (route de secours OTP).
- **À ajuster** : consulter systématiquement les docs Next.js embarquées
  (`node_modules/next/dist/docs/`) et les skills Prisma
  (`.agents/skills/`) avant d'écrire du code sur une version dont le
  comportement a pu changer depuis la connaissance générale du modèle —
  fait pour `proxy.ts` et Prisma 7 ce sprint, à garder en réflexe pour la
  suite.
