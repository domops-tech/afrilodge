import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
import { PropertyImage } from "@/components/PropertyImage";
import { createDownloadUrl } from "@/lib/storage/client";
import { computeExpiresAt } from "@/lib/verification/badge";
import { ReviewPanel } from "./ReviewPanel";

// Écran de validation d'une fiche (CDC §4.1.8) : tout ce que l'agent a
// constaté sur place, pour que l'admin décide en connaissance de cause.
export default async function FicheReviewPage({
  params,
}: PageProps<"/[locale]/admin/fiches/[requestId]">) {
  const { locale, requestId } = await params;
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const t = await getTranslations("admin");
  const tField = await getTranslations("field");
  const format = await getFormatter();

  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    include: {
      property: { include: { amenities: true } },
      owner: true,
      visit: {
        include: {
          agent: true,
          photos: true,
          amenityChecks: true,
          identityCheck: true,
        },
      },
    },
  });

  if (!request || !request.visit) notFound();

  const { visit } = request;
  const visitDate = visit.completedAt ?? visit.checkInAt;
  const identityUrl = visit.identityCheck
    ? await createDownloadUrl(visit.identityCheck.identityDocumentRef)
    : null;
  const titleUrl = visit.identityCheck
    ? await createDownloadUrl(visit.identityCheck.titleToRentRef)
    : null;

  const photosBySlot = new Map<string, typeof visit.photos>();
  for (const photo of visit.photos) {
    const list = photosBySlot.get(photo.slot) ?? [];
    list.push(photo);
    photosBySlot.set(photo.slot, list);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/admin" className="text-xs text-muted">
        ← {t("backToQueue")}
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">{request.property.title}</h1>
        <span className="text-sm text-muted">
          {request.property.neighborhood}, {request.property.city} · {request.owner.fullName} ·{" "}
          {t("agentLabel", { name: visit.agent.fullName })}
        </span>
        {visitDate ? (
          <span className="text-sm text-muted">
            {t("visitDateLabel", { date: format.dateTime(visitDate, { dateStyle: "long" }) })}
            {" · "}
            {t("expiresPreview", {
              date: format.dateTime(computeExpiresAt(visitDate), { dateStyle: "long" }),
            })}
          </span>
        ) : null}
      </header>

      {request.status !== "VISITED" ? (
        <p className="rounded-[var(--radius-default)] bg-surface p-3 text-sm">{t("alreadyDecided")}</p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t("sectionPhotos")}</h2>
        {[...photosBySlot.entries()].map(([slot, photos]) => (
          <div key={slot} className="flex flex-col gap-2">
            <span className="text-sm font-medium text-muted">{tField(`slot.${slot}`)}</span>
            <div className="flex flex-wrap gap-2">
              {photos.map((photo) => (
                <div key={photo.id} className="flex flex-col gap-1">
                  <PropertyImage
                    storageKey={photo.storageKey}
                    alt={photo.label ?? slot}
                    width={160}
                    height={120}
                    className="rounded-[var(--radius-default)] object-cover"
                  />
                  {photo.label ? <span className="text-xs text-muted">{photo.label}</span> : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t("sectionAmenities")}</h2>
        <div className="flex flex-col gap-1">
          {visit.amenityChecks.map((check) => (
            <div
              key={check.id}
              className="flex items-center justify-between rounded-[var(--radius-default)] border border-border p-2.5 text-sm"
            >
              <span>{check.amenityName}</span>
              {!check.observed ? (
                <span className="text-xs font-medium text-danger">{t("amenityDiscrepancy")}</span>
              ) : (
                <span className="text-xs text-verified">✓</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t("sectionLandmarks")}</h2>
        <p className="text-sm text-muted">{visit.accessLandmarks || "—"}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t("sectionIdentity")}</h2>
        {visit.identityCheck ? (
          <>
            <div className="flex gap-3">
              {identityUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL signée temporaire, next/image exigerait un domaine distant fixe
                <img src={identityUrl} alt={tField("identityDocumentLabel")} className="h-32 w-32 rounded-[var(--radius-default)] object-cover" />
              ) : null}
              {titleUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- idem
                <img src={titleUrl} alt={tField("titleToRentLabel")} className="h-32 w-32 rounded-[var(--radius-default)] object-cover" />
              ) : null}
            </div>
            <span className="text-sm">
              {visit.identityCheck.verifiedByAgent
                ? t("identityVerifiedByAgent")
                : t("identityNotVerifiedByAgent")}
            </span>
          </>
        ) : (
          <p className="text-sm text-muted">—</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t("sectionAttestation")}</h2>
        <p className="rounded-[var(--radius-default)] bg-surface p-3 text-sm italic">
          « Constaté par visite physique à la date indiquée. »
        </p>
        <p className="text-xs text-muted">{t("attestationNotice")}</p>
      </section>

      {request.status === "VISITED" ? (
        <ReviewPanel requestId={request.id} locale={locale} />
      ) : null}
    </div>
  );
}
