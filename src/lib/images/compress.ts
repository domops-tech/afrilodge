/**
 * Compression d'image côté client, avant envoi (CDC §7.1, §7.3 — "les
 * photographies représentent l'essentiel du poids des pages"). Utilisée par
 * l'application terrain de l'agent (S1) et par tout envoi de photo côté
 * propriétaire. Le budget en kilo-octets par fiche est contrôlé en CI par
 * Lighthouse (voir plan — Vérification, S3), ce module est le premier
 * levier pour le tenir.
 */

export const MAX_EDGE_PX = 1600;
export const TARGET_QUALITY = 0.82;
export const OUTPUT_MIME = "image/webp";

/**
 * Calcule les dimensions cibles en conservant le ratio, sans jamais
 * agrandir une image plus petite que la limite. Pure et testable sans
 * Canvas — la partie qui dessine réellement (`compressImageFile`) ne l'est
 * qu'en environnement navigateur et est couverte par les tests de bout en
 * bout de l'application terrain (S1).
 */
export function computeTargetDimensions(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE_PX
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    throw new RangeError("Dimensions d'image invalides");
  }

  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxEdge) {
    return { width, height };
  }

  const scale = maxEdge / longestEdge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

export interface CompressImageOptions {
  maxEdge?: number;
  quality?: number;
}

/**
 * Redimensionne et compresse un fichier image en WebP. Doit s'exécuter côté
 * navigateur (Canvas). Appelée depuis les composants d'envoi de photo, pas
 * depuis du code serveur.
 */
export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {}
): Promise<Blob> {
  const { maxEdge = MAX_EDGE_PX, quality = TARGET_QUALITY } = options;

  const bitmap = await createImageBitmap(file);
  const { width, height } = computeTargetDimensions(bitmap.width, bitmap.height, maxEdge);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Contexte Canvas 2D indisponible");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, OUTPUT_MIME, quality)
  );
  if (!blob) throw new Error("Échec de compression de l'image");
  return blob;
}
