import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/lib/auth/logout-action";
import { isReviewOverdue } from "@/lib/verification/badge";
import { ScheduleForm } from "./ScheduleForm";

// File du back-office : demandes à planifier (CDC §4.1.2) et fiches
// visitées en attente de validation (CDC §6.5.1), triées par ancienneté.
export default async function AdminQueuePage({
  params,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("ADMIN");
  const t = await getTranslations("admin");
  const tNav = await getTranslations("nav");
  const format = await getFormatter();

  const [user, toSchedule, agents, toReview] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.userId } }),
    prisma.verificationRequest.findMany({
      where: { status: "REQUESTED" },
      include: { property: true, owner: true, dispute: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({ where: { role: "AGENT" }, select: { id: true, fullName: true } }),
    prisma.verificationRequest.findMany({
      where: { status: "VISITED" },
      include: {
        property: true,
        owner: true,
        visit: { include: { agent: true } },
        dispute: true,
      },
      orderBy: { visit: { completedAt: "asc" } },
    }),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("greeting", { name: user.fullName })}</h1>
        <form action={logoutAction}>
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="ghost">
            {tNav("logout")}
          </Button>
        </form>
      </header>

      <nav className="flex gap-4 text-sm">
        <Link href="/admin/agents" className="font-medium text-accent">
          {t("agentsTitle")}
        </Link>
        <Link href="/admin/commissions" className="font-medium text-accent">
          {t("commissionsTitle")}
        </Link>
        <Link href="/admin/parametres" className="font-medium text-accent">
          {t("settingsTitle")}
        </Link>
        <Link href="/admin/litiges" className="font-medium text-accent">
          {t("disputesTitle")}
        </Link>
      </nav>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">{t("toScheduleTitle")}</h2>
        {toSchedule.length === 0 ? (
          <p className="text-sm text-muted">{t("noPendingSchedule")}</p>
        ) : (
          toSchedule.map((request) => (
            <Card
              key={request.id}
              data-testid={`schedule-request-${request.propertyId}`}
              className="flex flex-col gap-2"
            >
              <span className="font-medium">{request.property.title}</span>
              <span className="text-sm text-muted">{request.owner.fullName}</span>
              {request.dispute ? (
                <span className="self-start rounded-full bg-danger/15 px-2.5 py-1 text-xs font-medium text-danger">
                  {t("counterVisitBadge")}
                </span>
              ) : null}
              <ScheduleForm requestId={request.id} locale={locale} agents={agents} />
            </Card>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">{t("queueTitle")}</h2>
        {toReview.length === 0 ? (
          <p className="text-sm text-muted">{t("noFiches")}</p>
        ) : (
          toReview.map((request) => {
            const completedAt = request.visit?.completedAt;
            const overdue = completedAt ? isReviewOverdue(completedAt) : false;
            return (
              <Link key={request.id} href={`/admin/fiches/${request.id}`}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{request.property.title}</span>
                    <span className="text-sm text-muted">
                      {request.owner.fullName} · {t("agentLabel", { name: request.visit?.agent.fullName ?? "" })}
                      {completedAt ? ` · ${format.relativeTime(completedAt)}` : null}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {request.dispute ? (
                      <span className="rounded-full bg-danger/15 px-2.5 py-1 text-xs font-medium text-danger">
                        {t("counterVisitBadge")}
                      </span>
                    ) : null}
                    {overdue ? (
                      <span className="rounded-full bg-danger/15 px-2.5 py-1 text-xs font-medium text-danger">
                        {t("overdueBadge")}
                      </span>
                    ) : null}
                  </div>
                </Card>
              </Link>
            );
          })
        )}
      </section>
    </div>
  );
}
