import Image from "next/image";
import { resolvePublicStorageUrl } from "@/lib/storage/public-url";
import { getTranslations } from "next-intl/server";

function PhotoPlaceholder({ title, caption, wide = false }: { title: string; caption: string; wide?: boolean }) {
  return <div role="img" aria-label={`${title}. ${caption}`} className="photo-placeholder"><span className="photo-placeholder-content"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 3-4 5 6"/></svg><span className="photo-placeholder-caption">{title}</span>{wide ? <span className="photo-placeholder-caption">{caption}</span> : null}</span></div>;
}

/** Les images synthétiques du seed sont signalées textuellement, jamais
 * présentées comme une photo du logement. Les photos terrain réelles restent
 * optimisées par next/image avec leur ratio et leur chargement d'origine. */
export async function PropertyImage({
  storageKey, alt, width, height, priority = false, className, sizes = `${width}px`,
  isDemoPlaceholder = false, showPlaceholderDetail = false,
}: {
  storageKey: string; alt: string; width: number; height: number;
  priority?: boolean; className?: string; sizes?: string;
  isDemoPlaceholder?: boolean; showPlaceholderDetail?: boolean;
}) {
  if (isDemoPlaceholder || storageKey.startsWith("demo-placeholder/")) {
    const t = await getTranslations("common");
    return <PhotoPlaceholder title={t("demoPhotoBadge")} caption={t("photoUnavailable")} wide={showPlaceholderDetail} />;
  }
  return <Image src={resolvePublicStorageUrl(storageKey)} alt={alt} width={width} height={height} loading={priority ? undefined : "lazy"} priority={priority} className={className} sizes={sizes} />;
}
