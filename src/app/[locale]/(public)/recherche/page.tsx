import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Recherche par quartier/dates/budget (CDC §6.1) — construite au Sprint 3
// du backlog (docs/agile/product-backlog.md), une fois des fiches vérifiées
// disponibles à afficher (Sprints S1-S2). Cette page évite un lien mort
// depuis l'accueil en attendant.
export default async function SearchPlaceholderPage({
  params,
}: PageProps<"/[locale]/recherche">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-lg">{t("comingSoon")}</p>
      <Link href="/" className="text-sm font-medium text-accent">
        {t("back")}
      </Link>
    </div>
  );
}
