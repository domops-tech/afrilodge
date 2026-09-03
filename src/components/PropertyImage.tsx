import Image from "next/image";

/**
 * Affichage d'une photographie de bien à partir de sa clé de stockage objet
 * (jamais l'image directement — voir prisma/schema.prisma, VisitPhoto).
 * Chargement différé par défaut ; `priority` réservé à l'image au-dessus de
 * la ligne de flottaison (ex. première photo de la fiche détaillée).
 *
 * L'URL de base du CDN sert de service objet (CDC §7.1) ; en son absence
 * (développement sans pipeline branché), on retombe sur le stockage local
 * MinIO exposé par docker-compose.
 */
const CDN_BASE_URL = process.env.NEXT_PUBLIC_IMAGES_CDN_URL ?? "http://localhost:9000/sejours-photos";

function resolveSrc(storageKey: string) {
  return `${CDN_BASE_URL}/${storageKey}`;
}

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
      src={resolveSrc(storageKey)}
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
