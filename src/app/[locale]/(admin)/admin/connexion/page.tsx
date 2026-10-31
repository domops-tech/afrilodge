import { setRequestLocale, getTranslations } from "next-intl/server";
import { LoginLayout } from "@/components/auth/LoginLayout";
import { OtpLoginForm } from "@/components/auth/OtpLoginForm";
import { requestAdminOtpAction, verifyAdminOtpAction } from "./actions";

// Connexion administrateur (CDC §3) — compte provisionné, pas d'auto-inscription.
export default async function AdminLoginPage({
  params,
}: PageProps<"/[locale]/admin/connexion">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  const auth = await getTranslations("auth");

  return (
    <LoginLayout title={t("admin")} lede={auth("admin.lede")}>
      <OtpLoginForm requestAction={requestAdminOtpAction} verifyAction={verifyAdminOtpAction} />
    </LoginLayout>
  );
}
