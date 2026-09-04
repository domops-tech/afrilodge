# Séjours — VD Technologies

Plateforme de réservation de logements meublés vérifiés. Cahier des charges
complet : `docs/cdc/VD_Technologies_CDC_Sejours_v1.docx-1.pdf`. Suivi de
projet agile : `docs/agile/` (backlog, definition of done, journal de
sprints, décisions d'architecture).

## Démarrage

```bash
cp .env.example .env          # ajuster si besoin
docker compose up -d          # PostgreSQL (port 5433) + MinIO
npm install
npm run db:migrate            # première fois seulement
npm run storage:setup         # idem — crée le bucket MinIO et sa politique
npm run db:seed
npm run dev
```

Ouvrir `http://localhost:3000`. Le fournisseur SMS de développement
(`SMS_PROVIDER=console`) journalise le code à usage unique dans les logs du
serveur au lieu de l'envoyer.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm run start` | Build et exécution en production |
| `npm run lint` / `npm run typecheck` | Qualité statique |
| `npm test` / `npm run test:watch` | Tests unitaires (Vitest) |
| `npm run test:e2e` | Tests de bout en bout (Playwright — `npx playwright install chromium` une première fois) |
| `npm run db:migrate` / `npm run db:seed` / `npm run db:studio` | Base de données (Prisma 7) |
| `npm run storage:setup` | Crée le bucket MinIO local et sa politique de lecture |
| `npm run verifications:expire` | Expire les mentions échues et envoie les relances de renouvellement (CDC §6.5.2) — à planifier en tâche cron externe, voir décision 0005 |
| `npm run bookings:expire-holds` | Annule les demandes de réservation dont le verrou de calendrier a expiré sans paiement, et libère les jours (CDC §7.3) — même principe, à planifier en tâche cron externe |
| `POST /api/payments/release-overdue` (`x-cron-secret: $CRON_SECRET`) | Libère les fonds si le voyageur n'a pas confirmé son arrivée sous 24h (CDC §5.1.7, §8.6) — une route HTTP, pas un script `tsx`, voir décision 0012 ; à planifier en tâche cron externe |

## Comptes de démonstration (`prisma/seed.ts`)

Connexion par téléphone + code à usage unique (`+225…`, voir le seed pour la
liste complète). Le code s'affiche dans les logs du serveur en
développement.

- Propriétaire (`/connexion`) : `+2250700000020` (Fatou Diabaté, biens déjà
  vérifiés) — le compte se crée à la première connexion.
- Agent (`/terrain/connexion`) : `+2250700000011` (Jean-Marc Assouan, une
  visite lui est affectée sur le bien « Studio cosy, Plateau »). Compte
  provisionné par le seed, pas d'auto-inscription.
- Admin (`/admin/connexion`) : `+2250700000001`. Deux fiches déjà visitées
  attendent une décision : « Villa meublée, Bingerville » et « Chambre
  meublée, Yopougon ». `+2250700000002` (second compte admin, réservé au
  test e2e de planification, voir `e2e/owner-space.spec.ts`).
- Recherche publique (`/recherche`), sans connexion : trois biens
  vérifiés listés, chacun avec sa fiche détaillée complète.
- Voyageur (`/reserver/<id d'un bien vérifié>`), sans compte : sélection de
  dates, identification par téléphone + code à usage unique (session
  éphémère de 6h), demande envoyée au propriétaire, paiement simulé une
  fois acceptée, confirmation d'arrivée, annulation — voir épics 5 et 6.
  Simulateur Mobile Money (`PAYMENT_PROVIDER=simulated`) : aucun paiement
  réel, le bouton « Payer » sur `/reserver/paiement/[bookingId]` tient
  lieu d'établissement de paiement agréé tant que le §12 du CDC n'est pas
  tranché.

## Architecture

Voir `docs/agile/decisions/` pour le détail et les raisons de chaque choix.
En résumé : Next.js 16 (App Router, RSC), TypeScript strict, PostgreSQL via
Prisma 7, PWA, i18n FR/EN dès le socle, un seul dépôt pour les quatre
surfaces (voyageur, propriétaire, agent, admin) séparées par groupes de
routes sous `src/app/[locale]/`.

Points d'attention propres à ce dépôt (détaillés dans les fiches de
décision) : `src/proxy.ts` (renommage `middleware` → `proxy` de Next 16),
Prisma 7 (driver adapter explicite, client généré hors `node_modules`), et
l'état en mémoire partagé entre Server Actions et Route Handlers, qui doit
vivre sur `globalThis` et non sur une variable de module.
