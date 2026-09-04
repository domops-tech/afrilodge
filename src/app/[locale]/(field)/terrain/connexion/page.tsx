import { setRequestLocale, getTranslations } from "next-intl/server";
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

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">{t("field")}</h1>
      <OtpLoginForm requestAction={requestAgentOtpAction} verifyAction={verifyAgentOtpAction} />
    </div>
  );
}
