import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/lib/auth/logout-action";
import { isReviewOverdue } from "@/lib/verification/badge";

// File des fiches en attente de validation (CDC §6.5.1) — triée par visite
// la plus ancienne d'abord, celles en retard de plus de 24h signalées
// (CDC §11.2 : la publication doit intervenir sous 24h après la visite ;
// rien ne peut le forcer côté logiciel, cette file rend le délai visible).
export default async function AdminQueuePage({
  params,
}: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("ADMIN");
  const t = await getTranslations("admin");
  const tNav = await getTranslations("nav");
  const format = await getFormatter();

  const [user, requests] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.userId } }),
    prisma.verificationRequest.findMany({
      where: { status: "VISITED" },
      include: {
        property: true,
        owner: true,
        visit: { include: { agent: true } },
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

      <h2 className="text-sm font-medium text-muted">{t("queueTitle")}</h2>

      <div className="flex flex-col gap-3">
        {requests.length === 0 ? (
          <p className="text-sm text-muted">{t("noFiches")}</p>
        ) : (
          requests.map((request) => {
            const completedAt = request.visit?.completedAt;
            const overdue = completedAt ? isReviewOverdue(completedAt) : false;
            return (
              <Link key={request.id} href={`/admin/fiches/${request.id}`}>
                <Card className="flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{request.property.title}</span>
                    <span className="text-sm text-muted">
                      {request.owner.fullName} · {t("agentLabel", { name: request.visit?.agent.fullName ?? "" })}
                      {completedAt
                        ? ` · ${format.relativeTime(completedAt)}`
                        : null}
                    </span>
                  </div>
                  {overdue ? (
                    <span className="rounded-full bg-danger/15 px-2.5 py-1 text-xs font-medium text-danger">
                      {t("overdueBadge")}
                    </span>
                  ) : null}
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
