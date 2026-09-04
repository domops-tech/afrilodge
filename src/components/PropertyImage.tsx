import Image from "next/image";
import { resolvePublicStorageUrl } from "@/lib/storage/public-url";

/**
 * Affichage d'une photographie de bien à partir de sa clé de stockage objet
 * (jamais l'image directement — voir prisma/schema.prisma, VisitPhoto).
 * Chargement différé par défaut ; `priority` réservé à l'image au-dessus de
 * la ligne de flottaison (ex. première photo de la fiche détaillée).
 *
 * `sizes` doit refléter la taille d'affichage réelle, pas un défaut
 * générique : un défaut pensé pour une grande image hero a fait demander
 * un candidat 3840px pour une vignette de 160px lors de la revue admin
 * (Sprint 2, décision 0007) — next/image choisit sa taille de fichier à
 * partir de `sizes`, pas de `width`/`height` seuls. Budget CDC §7.3 :
 * vignette de liste ≤ 30 Ko.
 */
export function PropertyImage({
  storageKey,
  alt,
  width,
  height,
  priority = false,
  className,
  sizes = `${width}px`,
}: {
  storageKey: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
  /** Taille d'affichage réelle de l'image, en CSS `sizes`. Par défaut, la largeur fixe passée. */
  sizes?: string;
}) {
  return (
    <Image
      src={resolvePublicStorageUrl(storageKey)}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? undefined : "lazy"}
      priority={priority}
      className={className}
      sizes={sizes}
    />
  );
}
