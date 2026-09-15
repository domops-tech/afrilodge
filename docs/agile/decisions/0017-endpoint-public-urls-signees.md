# 0017 — Endpoint public distinct pour les URLs S3 signées

Signalé le 15 septembre 2026 : un agent connecté en production ne
parvenait pas à terminer la synchronisation d'une visite ("Échec de
synchronisation : vos données restent sauvegardées localement.
Réessayez.").

## Diagnostic

`STORAGE_ENDPOINT` en production vaut `http://minio:9000` — un nom de
service Docker interne, résolu uniquement à l'intérieur du réseau du
projet. `createUploadUrl()`/`createDownloadUrl()` (`src/lib/storage/client.ts`)
l'utilisaient pour SIGNER les URLs remises telles quelles à un navigateur
(upload direct de l'agent, lecture d'une pièce d'identité par l'admin —
CDC §7.1, décision 0006 : jamais un envoi qui transite par notre serveur
Node). Le navigateur ne pouvant pas résoudre `minio`, chaque envoi
échouait — silencieusement côté serveur (`/api/terrain/upload-url`
répond normalement, rien à journaliser : c'est le PUT direct du
navigateur vers MinIO qui échoue, invisible en dehors de l'appareil de
l'agent).

## Décision

`STORAGE_ENDPOINT` (interne, `http://minio:9000`) reste utilisé pour les
opérations qui ne quittent jamais le serveur (`ensureBucketExists`,
`putObjectDirect` — scripts). Un nouvel endpoint,
`STORAGE_PUBLIC_ENDPOINT`, sert uniquement à signer les URLs qui sortent
vers un navigateur. Absent (développement local, où MinIO est déjà public
sur `localhost`), on retombe sur `STORAGE_ENDPOINT`.

Côté infrastructure (`vd-platform`, `caddy/sites.d/afrilodge.vd-technologies.com.caddy`) :
un bloc Caddy route les requêtes dont le chemin commence par le nom du
bucket (`afrilodge-photos`) directement vers MinIO, **transmis identique,
sans aucune réécriture** — `handle`, pas `handle_path`. `STORAGE_PUBLIC_ENDPOINT`
est donc la racine du domaine, sans suffixe.

## Pourquoi pas un préfixe de chemin (`/s3/…`) ni un simple `handle_path`

Premier essai, écarté après un test réel en production (PUT direct depuis
l'extérieur, pas seulement en théorie) : un préfixe `/s3/` retiré côté
Caddy avant MinIO (`handle_path`, comme `/media/*`). Résultat :
`SignatureDoesNotMatch`. La signature AWS SigV4 d'une URL signée couvre
le **chemin entier** de l'endpoint configuré au moment de la signature —
un segment ajouté seulement pour le routage, puis retiré avant MinIO,
invalide la signature. Conservé tel quel (sans le retirer), MinIO n'en
sait rien non plus : en adressage par chemin, son premier segment de
chemin *est* le nom du bucket — `InvalidBucketName` (confirmé en testant
directement contre `127.0.0.1:8101`, hors Caddy, pour isoler la cause).
Seule route sans ambiguïté sans sous-domaine dédié : faire correspondre le
nom du bucket lui-même — qu'aucune route Next.js ne porte par ailleurs —
et le transmettre identique.

Conséquence acceptée : le nom du bucket apparaît dans ces URLs (contrairement
à `/media/*`, qui le masque délibérément). Sans risque réel : elles
expirent en 5 minutes et sont à usage unique (`expiresIn: 300`).

## Vérification

Testé de bout en bout en production avant de considérer le correctif
terminé : session d'agent jetable (cookie signé généré côté serveur, sans
jamais faire passer `AUTH_SECRET` par le réseau), `POST
/api/terrain/upload-url` réel, puis **PUT réel depuis une machine
extérieure au serveur** (pas depuis le serveur lui-même — condition
nécessaire pour reproduire fidèlement l'échec initial) vers l'URL signée
obtenue, lecture de l'objet déposé via `/media/*`, puis `POST
/api/terrain/visits/[visitId]/sync` réel. Toutes les données et
objets de test ont été supprimés après vérification.
