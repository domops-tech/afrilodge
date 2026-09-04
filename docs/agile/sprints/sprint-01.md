# Sprint 1 — Application terrain de l'agent

**Objectif** : un agent réalise une visite complète hors connexion et elle
remonte au serveur.

## Livré

Toutes les stories de l'épic 1 (voir `product-backlog.md`) :

- Connexion agent par téléphone + OTP, compte provisionné par le seed
  (pas d'auto-inscription, contrairement au propriétaire) —
  `src/lib/auth/login-flow.ts`, factorisé pour être partagé entre les
  surfaces propriétaire et agent (`OtpLoginForm`, `logoutAction`).
- Liste des visites affectées à l'agent (`/terrain`).
- Stockage local hors connexion (IndexedDB via Dexie —
  `src/lib/field/db.ts`) : brouillon de visite, photos en `Blob`,
  inventaire d'équipements, points de repère, pièce d'identité.
- Parcours de visite guidé en cinq étapes (`VisitWorkflow.tsx`) : photos
  imposées (façade, entrée, pièces × N, sanitaires, cuisine, vue, accès),
  inventaire des équipements annoncés avec écarts, points de repère
  d'accès, pièce d'identité + titre à louer, récapitulatif.
- Horodatage + géolocalisation à l'ouverture de la visite.
- Compression des photos avant stockage local (réutilise le pipeline du
  Sprint 0).
- Synchronisation différée applicative (`src/lib/field/sync.ts`) :
  déclenchée explicitement ou au retour du réseau — **pas** l'API
  Background Sync du navigateur (voir décision 0005).
- Stockage objet : upload direct vers MinIO par URL signée
  (`src/lib/storage/client.ts`, `/api/terrain/upload-url`), bucket
  namespacé par préfixe avec politique de lecture publique limitée aux
  photos de bien (voir décision 0006).
- Point d'arrivée de synchronisation (`/api/terrain/visits/[id]/sync`) :
  transaction Prisma qui crée photos, équipements constatés, pièce
  d'identité, fait passer la demande de vérification à VISITÉE.
- Test de bout en bout complet (`e2e/field-visit.spec.ts`) : connexion,
  visite entièrement saisie **hors connexion** (bascule réseau simulée),
  retour en ligne, synchronisation automatique, vérification en base que
  tout est bien remonté (photos, écart d'équipement, pièce d'identité,
  statut VISITÉE).

## Écarts et décisions prises en cours de route

- **Périmètre du hors connexion réduit à la donnée**, pas à l'application
  elle-même (pas de service worker/PWA installable) — voir décision 0005.
  Assumé, à réévaluer si un agent en a besoin sur le terrain.
- **Deux champs ajoutés au schéma** (`Visit.accessLandmarks`,
  `VisitPhoto.label`) pour porter les points de repère saisis par l'agent
  et distinguer les photos de pièces répétables.
- **Deux bugs Playwright, pas applicatifs**, rencontrés et corrigés dans le
  test e2e (documentés en commentaire dans `e2e/field-visit.spec.ts`) :
  - Une course entre le clic « Envoyer le code » et l'appel à la route de
    secours OTP — il fallait attendre la transition d'étape avant
    d'interroger le code, comme le fait déjà `e2e/auth.spec.ts`.
  - `.uncheck()`/`.check()` de Playwright échouent sur nos cases à cocher
    contrôlées dont l'état passe par une écriture IndexedDB asynchrone ;
    `.click()` suivi d'une assertion (qui, elle, retente automatiquement)
    fonctionne.
  - Le client Prisma généré (ESM pur) ne peut pas être importé directement
    depuis un fichier de test Playwright compilé en CommonJS ; la
    vérification finale du test interroge PostgreSQL via `pg` directement.
    Cette limite ne touche que les *fichiers de test*, pas l'application —
    voir décision 0001 pour le sujet plus large du bundling par route.

## Comment démontrer

```bash
docker compose up -d
npm run storage:setup   # une fois, crée le bucket MinIO et sa politique
npm run db:seed
npm run dev
```

Se connecter sur `/fr/terrain/connexion` avec `+2250700000011` (agent 2 du
seed, une visite lui est affectée sur le bien « Studio cosy, Plateau »).
Couper le réseau du navigateur après avoir démarré la visite : tout le
parcours reste utilisable. Rétablir le réseau : la synchronisation se
déclenche automatiquement.

`npm run test:e2e` rejoue ce parcours automatiquement, y compris la
bascule hors connexion.

## Rétrospective

- **Bien** : avoir testé la bascule hors connexion *dans* le test e2e
  (`context.setOffline`), pas seulement mocké — ça a immédiatement validé
  que la synchronisation différée fonctionne réellement, pas seulement en
  théorie.
- **À ajuster** : les schémas Zod des routes `/api/terrain/*` dupliquent
  partiellement les enums Prisma (`PhotoSlot`). Sans conséquence aujourd'hui,
  mais à surveiller si le schéma de visite évolue encore — un écart entre
  les deux passerait la validation Zod puis échouerait à l'écriture Prisma
  avec un message moins clair.
