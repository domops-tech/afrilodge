# 0001 — Pile technique

**Statut** : actée avec vous à la planification du Sprint 0 (voir échange
initial de cadrage).

## Décision

Next.js 16 (App Router) + TypeScript strict + PostgreSQL via Prisma 7,
Progressive Web App, un seul dépôt pour les quatre surfaces (voyageur,
propriétaire, agent, admin), séparées par groupes de routes.

## Pourquoi

- Le CDC (§7.1) demande une réutilisation maximale d'un socle existant
  auquel je n'ai pas accès depuis ce dossier ; en son absence, Next.js sert
  de socle par défaut le plus rapide à mettre en œuvre pour du rendu serveur
  léger, exigé par la contrainte Android d'entrée de gamme (§2, §11.3).
- Le rendu serveur (React Server Components) minimise le JavaScript envoyé
  au voyageur ; le client-side reste réservé aux surfaces qui en ont
  vraiment besoin (app terrain hors connexion, calendrier).
- Un seul dépôt évite de dupliquer l'authentification téléphone + OTP
  (§3) entre quatre projets séparés.

## Conséquences et notes techniques (à relire avant tout Sprint ultérieur)

- **Next 16 renomme `middleware.ts` en `proxy.ts`** — et ce fichier doit
  vivre dans `src/` (pas à la racine) puisque le projet utilise un dossier
  `src/`. Voir `src/proxy.ts` et
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
  Next.js déconseille explicitement de s'appuyer sur le proxy seul pour
  l'autorisation : chaque Server Function protégée doit se garder
  elle-même — voir `src/lib/auth/guard.ts`.
- **Prisma 7** exige un driver adapter explicite (`@prisma/adapter-pg`), un
  chemin de sortie de client explicite (`src/generated/prisma`, non versionné),
  et ne génère plus le client ni ne lance les seeds automatiquement après
  `migrate dev` — toujours exécuter `prisma generate` / `prisma db seed`
  explicitement (voir `.agents/skills/prisma-upgrade-v7/` pour le détail
  complet des changements).
- **État en mémoire du process et bundling par route** : Next.js compile
  Server Actions et Route Handlers en bundles distincts, chacun avec sa
  propre instance des modules qu'il importe. Une variable de module
  (`const x = new Map()`) n'est donc **pas** partagée entre une Server
  Action et une Route Handler, même dans le même process `next start`. Tout
  état en mémoire qui doit être visible des deux (voir la fiche 0002, le
  simulateur de paiement, et `src/lib/sms/provider.ts`) doit vivre sur
  `globalThis`, jamais sur une variable de module — bug réel rencontré et
  corrigé pendant le Sprint 0 (le test e2e `e2e/auth.spec.ts` le couvre).
