import { setRequestLocale, getTranslations } from "next-intl/server";
import { OtpLoginForm } from "@/components/auth/OtpLoginForm";
import { requestOwnerOtpAction, verifyOwnerOtpAction } from "./actions";

// Connexion propriétaire (CDC §3, §5.2.16) — voir
// src/app/[locale]/(field)/terrain/connexion/page.tsx pour l'équivalent
// agent, même composant de formulaire, actions différentes.
export default async function LoginPage({
  params,
}: PageProps<"/[locale]/connexion">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">{t("login")}</h1>
      <OtpLoginForm
        requestAction={requestOwnerOtpAction}
        verifyAction={verifyOwnerOtpAction}
        showFullName
        showEmailField
      />
    </div>
  );
}
