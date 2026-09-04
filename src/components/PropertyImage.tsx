import Image from "next/image";
import { resolvePublicStorageUrl } from "@/lib/storage/public-url";

/**
 * Affichage d'une photographie de bien à partir de sa clé de stockage objet
 * (jamais l'image directement — voir prisma/schema.prisma, VisitPhoto).
 * Chargement différé par défaut ; `priority` réservé à l'image au-dessus de
 * la ligne de flottaison (ex. première photo de la fiche détaillée).
 */
export function PropertyImage({
  storageKey,
  alt,
  width,
  height,
  priority = false,
  className,
}: {
  storageKey: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
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
      sizes="(max-width: 640px) 100vw, 640px"
    />
  );
}
