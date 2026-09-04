import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { Link } from "@/i18n/navigation";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { getCommissionRate, getFullRefundWindowDays } from "@/lib/settings";
import { updateSettingsAction } from "./actions";

/**
 * Politique globale paramétrable en back-office (CDC §6.5.4, §8.7) — taux
 * de commission et délai de remboursement intégral avant annulation.
 * Jamais modifiable par le propriétaire (décision prise avec vous à la
 * planification du Sprint 6).
 */
export default async function SettingsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/parametres">) {
  const { locale } = await params;
  const { erreur } = await searchParams;
  setRequestLocale(locale);
  await requireRole("ADMIN");
  const t = await getTranslations("admin");

  const [commissionRate, fullRefundWindowDays] = await Promise.all([
    getCommissionRate(),
    getFullRefundWindowDays(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/admin" className="text-xs text-muted">
        ← {t("backToQueue")}
      </Link>

      <h1 className="text-xl font-semibold">{t("settingsTitle")}</h1>

      {typeof erreur === "string" ? (
        <p className="rounded-[var(--radius-default)] bg-danger/10 p-3 text-sm text-danger">
          {t("settingsError")}
        </p>
      ) : null}

      <form action={updateSettingsAction} className="flex max-w-sm flex-col gap-4">
        <input type="hidden" name="locale" value={locale} />
        <Field
          id="commissionRatePercent"
          name="commissionRatePercent"
          type="number"
          min={0}
          max={100}
          step="0.1"
          label={t("commissionRateLabel")}
          defaultValue={(commissionRate * 100).toString()}
          required
        />
        <Field
          id="fullRefundWindowDays"
          name="fullRefundWindowDays"
          type="number"
          min={0}
          label={t("refundWindowLabel")}
          defaultValue={fullRefundWindowDays.toString()}
          required
        />
        <Button type="submit" className="self-start">
          {t("settingsSaveCta")}
        </Button>
      </form>
    </div>
  );
}
