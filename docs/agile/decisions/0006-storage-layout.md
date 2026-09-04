# 0006 — Un bucket, deux préfixes, une politique

**Statut** : actée en construisant l'épic 1 (upload des photos de visite et
des pièces d'identité).

## Décision

Un seul bucket S3-compatible (`STORAGE_BUCKET`, MinIO en développement),
namespacé par préfixe :

- `visits/{visitId}/…` — photographies de bien (façade, pièces, etc.).
  Lecture publique anonyme, via une politique de bucket limitée à ce
  préfixe (`src/lib/storage/client.ts`, `ensureBucketExists`).
- `identity/{visitId}/…` — pièce d'identité et titre à louer du
  propriétaire. Reste privé ; jamais résolu par `PropertyImage` ni par
  aucune route publique.

Les envois se font par URL signée (`createUploadUrl`), générée par
`/api/terrain/upload-url` après vérification que l'agent authentifié est
bien celui affecté à la visite — jamais un envoi qui transite par notre
serveur Node.

## Pourquoi

- Respecte le CDC §10.2 : les documents d'identité sont des données
  personnelles sensibles, à distinguer structurellement des photographies
  de bien qui, elles, doivent être publiquement accessibles une fois la
  fiche publiée (§6.1 — fiche détaillée visible sans connexion).
- Un bucket unique avec préfixes évite la complexité opérationnelle de
  plusieurs buckets (identifiants, politiques, quotas séparés) tout en
  gardant une séparation de sécurité réelle : la politique de lecture
  publique cible littéralement `arn:aws:s3:::{bucket}/visits/*`, rien
  d'autre.
- URL signée plutôt que proxy applicatif : les photographies, poste le plus
  lourd des pages (CDC §7.3), ne doivent pas transiter deux fois par notre
  serveur (agent → serveur → stockage puis stockage → CDN → voyageur).

## Point de vigilance pour le Sprint 2

Le back-office devra générer ses propres URLs signées **de lecture** pour
afficher les pièces d'identité aux administrateurs lors de la validation —
jamais via une URL publique. Réutiliser `getSignedUrl` avec une
`GetObjectCommand`, pas la logique d'écriture existante.
