import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";

/**
 * Journal des commissions et rapprochement (CDC §6.5.4, §8.8, épic 6.6) :
 * une ligne par réservation payée, réglée ou non. Le total réglé sert de
 * base de rapprochement avec le PSP le jour où il est réel (§12) — une vue
 * table suffit pour une v1, pas d'export CSV ni de filtre pour l'instant.
 */
export default async function CommissionsPage({
  params,
}: PageProps<"/[locale]/admin/commissions">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const t = await getTranslations("admin");
  const format = await getFormatter();

  const entries = await prisma.commissionEntry.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      booking: { include: { property: { select: { title: true, ownerId: true } } } },
    },
  });

  const ownerIds = [...new Set(entries.map((e) => e.booking?.property.ownerId).filter((id): id is string => Boolean(id)))];
  const owners = await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, fullName: true } });
  const ownerNameById = new Map(owners.map((o) => [o.id, o.fullName]));

  const totalSettled = entries.filter((e) => e.settledAt).reduce((sum, e) => sum + e.amount, 0);
  const totalPending = entries.filter((e) => !e.settledAt).reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/admin" className="text-xs text-muted">
        ← {t("backToQueue")}
      </Link>

      <h1 className="text-xl font-semibold">{t("commissionsTitle")}</h1>

      <div className="flex gap-4 text-sm">
        <Card className="flex-1">
          <span className="text-muted">{t("commissionsSettledTotal")}</span>
          <p className="text-lg font-semibold">{totalSettled} FCFA</p>
        </Card>
        <Card className="flex-1">
          <span className="text-muted">{t("commissionsPendingTotal")}</span>
          <p className="text-lg font-semibold">{totalPending} FCFA</p>
        </Card>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted">{t("commissionsEmpty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex flex-col gap-1">
                <span className="font-medium">{entry.booking?.property.title ?? "—"}</span>
                <span className="text-muted">
                  {entry.booking?.property.ownerId ? ownerNameById.get(entry.booking.property.ownerId) : "—"} ·{" "}
                  {(entry.rate * 100).toFixed(0)} %
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="font-medium">{entry.amount} FCFA</span>
                <span className="text-xs text-muted">
                  {entry.settledAt
                    ? t("commissionsSettledOn", { date: format.dateTime(entry.settledAt, { dateStyle: "medium" }) })
                    : t("commissionsPending")}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
