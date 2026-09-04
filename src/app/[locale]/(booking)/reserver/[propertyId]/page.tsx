import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Tunnel de réservation (CDC §6.2) — construit au Sprint 5, une fois la
// disponibilité et le paiement en place (Sprints S4-S6). Évite un lien mort
// depuis la fiche détaillée en attendant (même principe que le placeholder
// de recherche du Sprint 0).
export default async function BookingPlaceholderPage({
  params,
}: PageProps<"/[locale]/reserver/[propertyId]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-lg">{t("comingSoon")}</p>
      <Link href="/recherche" className="text-sm font-medium text-accent">
        {t("back")}
      </Link>
    </div>
  );
}
