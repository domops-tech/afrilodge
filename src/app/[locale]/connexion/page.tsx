import { setRequestLocale, getTranslations } from "next-intl/server";
import { LoginForm } from "./LoginForm";

// Connexion propriétaire (CDC §3, §5.2.16). Les connexions agent et
// administrateur arrivent avec leurs surfaces respectives (S1, S2) et
// réutilisent src/lib/auth/otp.ts sans le dupliquer.
export default async function LoginPage({
  params,
}: PageProps<"/[locale]/connexion">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">{t("login")}</h1>
      <LoginForm />
    </div>
  );
}
