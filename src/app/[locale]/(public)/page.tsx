import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/Button";

export default async function HomePage({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tNav = await getTranslations("nav");
  const tCommon = await getTranslations("common");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-lg font-semibold">{tCommon("appName")}</span>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link href="/connexion" className="text-sm font-medium text-accent">
            {tNav("login")}
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <h1 className="max-w-sm text-3xl font-semibold leading-tight">{t("tagline")}</h1>
        <Link href="/recherche">
          <Button>{t("searchCta")}</Button>
        </Link>
      </main>
    </div>
  );
}
