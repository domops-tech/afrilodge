import { setRequestLocale, getTranslations } from "next-intl/server";
import { OtpLoginForm } from "@/components/auth/OtpLoginForm";
import { requestAdminOtpAction, verifyAdminOtpAction } from "./actions";

// Connexion administrateur (CDC §3) — compte provisionné, pas d'auto-inscription.
export default async function AdminLoginPage({
  params,
}: PageProps<"/[locale]/admin/connexion">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">{t("admin")}</h1>
      <OtpLoginForm requestAction={requestAdminOtpAction} verifyAction={verifyAdminOtpAction} />
    </div>
  );
}
