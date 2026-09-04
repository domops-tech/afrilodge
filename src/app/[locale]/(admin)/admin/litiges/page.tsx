import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { triggerCounterVisitAction, resolveDisputeDirectlyAction } from "./actions";

/**
 * Traitement des litiges au back-office (CDC §6.5.3, épic 7.4) : les
 * écarts signalés par les voyageurs (épic 7.1), triés par ancienneté,
 * ouverts en premier. Une contre-visite (épic 7.2) réutilise la file de
 * planification et la fiche de revue déjà construites (Sprints 2 et 4) —
 * son issue se décide sur `/admin/fiches/[requestId]`, pas ici.
 */
export default async function DisputesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/litiges">) {
  const { locale } = await params;
  const { erreur } = await searchParams;
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const t = await getTranslations("admin");
  const format = await getFormatter();

  const disputes = await prisma.dispute.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: {
      property: { select: { title: true, ownerId: true } },
      booking: { select: { checkIn: true, checkOut: true } },
      counterVisitRequest: { select: { status: true } },
    },
  });

  const ownerIds = [...new Set(disputes.map((d) => d.property.ownerId))];
  const owners = await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, fullName: true } });
  const ownerNameById = new Map(owners.map((o) => [o.id, o.fullName]));

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/admin" className="text-xs text-muted">
        ← {t("backToQueue")}
      </Link>

      <h1 className="text-xl font-semibold">{t("disputesTitle")}</h1>

      {typeof erreur === "string" ? (
        <p className="rounded-[var(--radius-default)] bg-danger/10 p-3 text-sm text-danger">
          {t("disputeActionError")}
        </p>
      ) : null}

      {disputes.length === 0 ? (
        <p className="text-sm text-muted">{t("disputesEmpty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {disputes.map((dispute) => (
            <Card key={dispute.id} className="flex flex-col gap-3 text-sm" data-testid={`dispute-${dispute.id}`}>
              <div className="flex flex-col gap-1">
                <span className="font-medium">{dispute.property.title}</span>
                <span className="text-muted">{ownerNameById.get(dispute.property.ownerId)}</span>
                {dispute.booking ? (
                  <span className="text-xs text-muted">
                    {format.dateTime(dispute.booking.checkIn, { dateStyle: "medium" })} →{" "}
                    {format.dateTime(dispute.booking.checkOut, { dateStyle: "medium" })}
                  </span>
                ) : null}
                <span>{dispute.reason}</span>
              </div>

              <span className="text-xs font-medium text-muted">{t(`disputeStatus.${dispute.status}`)}</span>

              {dispute.status === "OPEN" ? (
                <div className="flex flex-col gap-3 border-t border-border pt-3">
                  <form action={triggerCounterVisitAction}>
                    <input type="hidden" name="disputeId" value={dispute.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <Button type="submit" variant="secondary">
                      {t("triggerCounterVisitCta")}
                    </Button>
                  </form>

                  <form action={resolveDisputeDirectlyAction} className="flex flex-col gap-2">
                    <input type="hidden" name="disputeId" value={dispute.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <Field id={`note-${dispute.id}`} name="note" label={t("resolutionNoteLabel")} required />
                    <div className="flex gap-2">
                      <Button type="submit" name="outcome" value="kept" variant="ghost">
                        {t("resolveKeptCta")}
                      </Button>
                      <Button type="submit" name="outcome" value="withdrawn" variant="ghost">
                        {t("resolveWithdrawnCta")}
                      </Button>
                    </div>
                  </form>
                </div>
              ) : null}

              {dispute.status === "COUNTER_VISIT_SCHEDULED" && dispute.counterVisitRequest ? (
                <span className="text-xs text-muted">
                  {t(`counterVisitRequestStatus.${dispute.counterVisitRequest.status}`)}
                </span>
              ) : null}

              {dispute.resolutionNote ? (
                <span className="text-xs text-muted">{dispute.resolutionNote}</span>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
