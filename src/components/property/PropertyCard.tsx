import { nbsp } from "@/lib/format/nbsp";
import type { $Enums } from "@/generated/prisma/client";
import { getTranslations, getFormatter } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { selectionQuery } from "@/lib/booking/selection";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { PropertyImage } from "@/components/property/PropertyImage";

type CardProperty = {
  id: string;
  isDemo: boolean;
  title: string;
  neighborhood: string;
  city: string;
  pricePerNight: number;
  maxGuests: number;
  verification: { status: $Enums.VerificationStatus; visitDate: Date; expiresAt: Date } | null;
};
type PropertyPhoto = { storageKey: string; isDemoPlaceholder: boolean };

export async function PropertyCard({ property, photo, params = {}, priority = false }: {
  property: CardProperty;
  photo: PropertyPhoto | null;
  params?: Record<string, string | string[] | undefined>;
  priority?: boolean;
}) {
  const t = await getTranslations("search");
  const tc = await getTranslations("common");
  const formatter = await getFormatter();
  const target = `/logements/${property.id}${selectionQuery(params)}`;
  return (
    <article className="min-w-0">
      <Link href={target} className="property-card-link group block rounded-[var(--radius)] focus-visible:outline-offset-4">
        <div className="card-photo">
          {photo ? <PropertyImage storageKey={photo.storageKey} isDemoPlaceholder={photo.isDemoPlaceholder} alt="" width={620} height={465} priority={priority} sizes="(max-width: 374px) calc(100vw - 2rem), (max-width: 767px) calc((100vw - 3rem) / 2), (max-width: 1023px) 44vw, (max-width: 1599px) 31vw, 23vw" className="h-full w-full object-cover" /> : <div role="img" aria-label={t("photoUnavailable")} className="photo-placeholder"><span className="photo-placeholder-content"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 3-4 5 6"/></svg><span className="photo-placeholder-caption">{t("photoUnavailable")}</span></span></div>}
          {property.verification ? <span className="absolute left-3 top-3"><VerifiedBadge verification={property.verification} compact /></span> : null}
          {property.isDemo ? <span className="absolute bottom-3 left-3 rounded-full bg-background/95 px-2.5 py-1 text-[.7rem] font-semibold text-foreground">{tc("demoListing")}</span> : null}
        </div>
        <div className="mt-3.5 flex flex-col gap-1">
          <h2 className="line-clamp-2 text-[1.0625rem] font-semibold leading-snug tracking-[-.01em] text-foreground transition-colors group-hover:text-accent">{property.title}</h2>
          <p className="text-sm text-muted">{property.neighborhood} <span aria-hidden="true">·</span> {property.city}</p>
          <p className="mt-1 text-sm"><span className="font-semibold tabular-nums">{nbsp(formatter.number(property.pricePerNight))} {t("perNight")}</span> <span className="text-muted">· {t("capacity", { count: property.maxGuests })}</span></p>
        </div>
      </Link>
    </article>
  );
}
