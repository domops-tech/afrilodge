import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/lib/auth/logout-action";

// Liste des visites affectées à l'agent (CDC §6.4.1).
export default async function AgentVisitsPage({
  params,
}: PageProps<"/[locale]/terrain">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("AGENT");
  const t = await getTranslations("field");
  const tNav = await getTranslations("nav");
  const format = await getFormatter();

  const [user, visits] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.userId } }),
    prisma.visit.findMany({
      where: { agentId: session.userId, completedAt: null },
      include: { verificationRequest: { include: { property: true } } },
      orderBy: { scheduledAt: "asc" },
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

      <div className="flex flex-col gap-3">
        {visits.length === 0 ? (
          <p className="text-sm text-muted">{t("noVisits")}</p>
        ) : (
          visits.map((visit) => (
            <Link key={visit.id} href={`/terrain/visite/${visit.id}`}>
              <Card className="flex flex-col gap-1">
                <span className="font-medium">
                  {visit.verificationRequest.property.title}
                </span>
                <span className="text-sm text-muted">
                  {visit.verificationRequest.property.neighborhood},{" "}
                  {visit.verificationRequest.property.city} ·{" "}
                  {format.dateTime(visit.scheduledAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
