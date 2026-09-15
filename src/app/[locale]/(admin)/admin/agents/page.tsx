import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { CreateAgentForm } from "./CreateAgentForm";

/**
 * Gestion des comptes agents (CDC §3) — jusqu'ici provisionnés uniquement
 * par `prisma/seed.ts` ou une insertion manuelle en base ; voir
 * src/app/[locale]/(admin)/admin/agents/actions.ts pour le détail de la
 * contrainte d'email obligatoire côté création.
 */
export default async function AgentsPage({
  params,
}: PageProps<"/[locale]/admin/agents">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const t = await getTranslations("admin");

  const agents = await prisma.user.findMany({
    where: { role: "AGENT" },
    orderBy: { createdAt: "desc" },
    select: { id: true, fullName: true, phone: true, email: true },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/admin" className="text-xs text-muted">
        ← {t("backToQueue")}
      </Link>

      <h1 className="text-xl font-semibold">{t("agentsTitle")}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">{t("createAgentTitle")}</h2>
        <CreateAgentForm locale={locale} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">{t("agentsListTitle")}</h2>
        {agents.length === 0 ? (
          <p className="text-sm text-muted">{t("noAgents")}</p>
        ) : (
          agents.map((agent) => (
            <Card key={agent.id} data-testid={`agent-${agent.id}`} className="flex flex-col gap-1">
              <span className="font-medium">{agent.fullName}</span>
              <span className="text-sm text-muted">
                {agent.phone} · {agent.email}
              </span>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
