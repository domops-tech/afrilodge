import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

/**
 * Stockage objet des photographies (CDC §7.1), MinIO en développement,
 * S3-compatible en production. Un seul client, pas d'abstraction
 * supplémentaire : contrairement au paiement ou au SMS, le protocole S3 est
 * déjà un standard multi-fournisseur, il n'y a rien à isoler derrière un
 * second port.
 */

function getClient(): S3Client {
  return new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT,
    region: process.env.STORAGE_REGION ?? "us-east-1",
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? "",
    },
  });
}

function getBucket(): string {
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) throw new Error("STORAGE_BUCKET manquant — voir .env.example");
  return bucket;
}

export type UploadKind = "visit-photo" | "identity-document";

/**
 * Construit une clé de stockage prévisible et namespacée. Les documents
 * d'identité vivent sous un préfixe distinct des photos de bien : jamais
 * résolu par PropertyImage ni par aucune route publique (CDC §10.2).
 */
export function buildStorageKey(kind: UploadKind, visitId: string, extension = "webp"): string {
  const prefix = kind === "identity-document" ? "identity" : "visits";
  return `${prefix}/${visitId}/${randomUUID()}.${extension}`;
}

/**
 * URL signée à durée limitée pour un envoi direct du navigateur vers le
 * stockage objet — l'image ne transite jamais par notre serveur Node.
 */
export async function createUploadUrl(storageKey: string, contentType: string): Promise<string> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: 300 });
}

/**
 * URL signée de lecture, durée courte — réservée à l'admin pour consulter
 * une pièce d'identité (préfixe `identity/`, privé) au moment de la
 * validation d'une fiche (CDC §4.1.8). Ne jamais utiliser pour le préfixe
 * `visits/`, déjà public : voir docs/agile/decisions/0006.
 */
export async function createDownloadUrl(storageKey: string): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: storageKey });
  return getSignedUrl(client, command, { expiresIn: 300 });
}

/**
 * Envoi direct depuis le serveur, credentials en main — réservé aux scripts
 * (ex. prisma/seed.ts) qui n'ont pas de navigateur pour consommer une URL
 * signée. Ne pas utiliser depuis une route HTTP : voir createUploadUrl.
 */
export async function putObjectDirect(
  storageKey: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const client = getClient();
  await client.send(
    new PutObjectCommand({ Bucket: getBucket(), Key: storageKey, Body: body, ContentType: contentType })
  );
}

/**
 * Crée le bucket s'il n'existe pas encore, et une politique de lecture
 * publique limitée au préfixe `visits/` — voir scripts/setup-storage.ts.
 * Le préfixe `identity/` (pièces d'identité, CDC §10.2) reste privé : accès
 * uniquement via une URL signée générée côté serveur pour le back-office.
 */
export async function ensureBucketExists(): Promise<void> {
  const client = getClient();
  const bucket = getBucket();
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }

  await client.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: "*",
            Action: "s3:GetObject",
            Resource: `arn:aws:s3:::${bucket}/visits/*`,
          },
        ],
      }),
    })
  );
}
