import { setRequestLocale, getTranslations } from "next-intl/server";
import { LoginLayout } from "@/components/auth/LoginLayout";
import { OtpLoginForm } from "@/components/auth/OtpLoginForm";
import { requestAgentOtpAction, verifyAgentOtpAction } from "./actions";

// Connexion agent (CDC §3) — compte provisionné par VD Technologies, pas
// d'auto-inscription (voir actions.ts).
export default async function AgentLoginPage({
  params,
}: PageProps<"/[locale]/terrain/connexion">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  const auth = await getTranslations("auth");

  return (
    <LoginLayout split={false} title={t("field")} lede={auth("agent.lede")}>
      <OtpLoginForm requestAction={requestAgentOtpAction} verifyAction={verifyAgentOtpAction} />
    </LoginLayout>
  );
}
