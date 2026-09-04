import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { AMENITY_OPTIONS } from "@/lib/property/amenities";
import { createPropertyAction } from "./actions";

// Création d'un bien par le propriétaire — préalable à la demande de
// vérification (CDC §5.2.16). Quartier/ville/équipements ne sont
// modifiables qu'ici : une fois une visite réalisée, ils passent sous le
// contrôle du flux de vérification (CDC §6.3.2, voir prisma/schema.prisma).
export default async function NewPropertyPage({
  params,
  searchParams,
}: PageProps<"/[locale]/proprietaire/nouveau">) {
  const { locale } = await params;
  const { erreur } = await searchParams;
  setRequestLocale(locale);
  await requireRole("OWNER");
  const t = await getTranslations("owner");

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">{t("newPropertyTitle")}</h1>
      {typeof erreur === "string" ? (
        <p className="rounded-[var(--radius-default)] bg-danger/10 p-3 text-sm text-danger">
          {t(`error.${erreur}`)}
        </p>
      ) : null}
      <form action={createPropertyAction} className="flex max-w-lg flex-col gap-4">
        <input type="hidden" name="locale" value={locale} />
        <Field id="title" name="title" label={t("titleLabel")} required />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("descriptionLabel")}</span>
          <textarea
            id="description"
            name="description"
            required
            minLength={10}
            className="min-h-24 rounded-[var(--radius-default)] border border-border bg-background p-3 text-base"
          />
        </label>
        <Field id="neighborhood" name="neighborhood" label={t("neighborhoodLabel")} required />
        <Field id="city" name="city" label={t("cityLabel")} required defaultValue="Abidjan" />
        <Field id="pricePerNight" name="pricePerNight" type="number" min={1} label={t("priceLabel")} required />
        <Field id="maxGuests" name="maxGuests" type="number" min={1} label={t("maxGuestsLabel")} required />

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t("amenitiesLabel")}</legend>
          {AMENITY_OPTIONS.map((name) => (
            <label key={name} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={`amenity_${name}`} className="h-5 w-5" />
              {name}
            </label>
          ))}
        </fieldset>

        <Button type="submit">{t("createCta")}</Button>
      </form>
    </div>
  );
}
