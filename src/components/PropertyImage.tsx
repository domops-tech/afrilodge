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
 *
 * `width`/`height` doivent correspondre au **ratio réel** de l'image, ou
 * `className` doit figer les deux dimensions (ex. `h-24 w-24
 * object-cover`, cadrage rogné) plutôt que de n'en laisser flotter qu'une
 * seule (`h-auto` seul, ou `w-full` seul). next/image compare le rendu
 * final aux attributs `width`/`height` HTML : si une seule dimension
 * s'en écarte (l'autre restant identique à l'attribut), il avertit d'une
 * distorsion possible — y compris quand le ratio déclaré ne correspond
 * pas au ratio réel du fichier (ce qui arrive vite avec des vignettes
 * standardisées 4:3 sur des photos réelles 3:2). Pour un rendu qui
 * préserve le ratio (pas de recadrage), laisser flotter `width` **et**
 * `height` ensemble (`w-full h-auto`), jamais un seul des deux.
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
