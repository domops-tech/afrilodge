import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Card } from "@/components/ui/Card";
import { buttonClassName } from "@/components/ui/Button";
import { nbsp } from "@/lib/format/nbsp";

// Espace propriétaire (CDC §6.3).
export default async function OwnerDashboardPage({
  params,
}: PageProps<"/[locale]/proprietaire">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireRole("OWNER");
  const format = await getFormatter();
  const tOwner = await getTranslations("owner");

  const [user, properties] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.userId } }),
    prisma.property.findMany({
      where: { ownerId: session.userId },
      include: { verification: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>{tOwner("greeting", { name: user.fullName })}</h1>
          <p className="mt-1 text-sm text-muted">{tOwner("dashboardIntro")}</p>
        </div>
        <Link href="/proprietaire/nouveau" className={buttonClassName("primary")}>{tOwner("newPropertyCta")}</Link>
      </div>

      {properties.length === 0 ? (
        <p className="surface-card-plain p-6 text-muted">{tOwner("noProperties")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {properties.map((property) => (
            <Link key={property.id} href={`/proprietaire/biens/${property.id}`} className="block rounded-[var(--radius)] transition-shadow hover:shadow-[var(--shadow-card)]">
              <Card className="flex h-full flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="t-3">{property.title}</span>
                  {property.verification ? <VerifiedBadge verification={property.verification} compact /> : null}
                </div>
                <span className="text-sm text-muted">
                  {property.neighborhood}, {property.city} · {nbsp(format.number(property.pricePerNight))} FCFA / {tOwner("perNight")}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
