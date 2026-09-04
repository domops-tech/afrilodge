import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/lib/auth/logout-action";

// Espace propriétaire (CDC §6.3) — la vue d'ensemble ici prouve la
// plomberie de bout en bout du Sprint 0 (auth, base, i18n). Le contenu
// complet (calendrier, réservations, revenus) arrive au Sprint 4.
export default async function OwnerDashboardPage({
  params,
}: PageProps<"/[locale]/proprietaire">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("OWNER");
  const t = await getTranslations("nav");

  const [user, properties] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.userId } }),
    prisma.property.findMany({
      where: { ownerId: session.userId },
      include: { verification: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Bonjour, {user.fullName}</h1>
        <form action={logoutAction}>
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="ghost">
            {t("logout")}
          </Button>
        </form>
      </header>

      <div className="flex flex-col gap-3">
        {properties.length === 0 ? (
          <p className="text-sm text-muted">Aucun bien pour ce compte de démonstration.</p>
        ) : (
          properties.map((property) => (
            <Card key={property.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{property.title}</span>
                {property.verification ? (
                  <VerifiedBadge verification={property.verification} />
                ) : null}
              </div>
              <span className="text-sm text-muted">
                {property.neighborhood}, {property.city} · {property.pricePerNight} FCFA / nuit
              </span>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
