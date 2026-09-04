/**
 * URL publique d'un objet sous le préfixe `visits/` (public, voir
 * docs/agile/decisions/0006) — jamais pour le préfixe `identity/`, qui
 * exige une URL signée générée côté serveur (createDownloadUrl).
 *
 * Pas de secret ici : safe à importer depuis un composant client
 * (PropertyImage) comme depuis un composant serveur (back-office).
 */
const CDN_BASE_URL = process.env.NEXT_PUBLIC_IMAGES_CDN_URL ?? "http://localhost:9000/sejours-photos";

export function resolvePublicStorageUrl(storageKey: string): string {
  return `${CDN_BASE_URL}/${storageKey}`;
}
