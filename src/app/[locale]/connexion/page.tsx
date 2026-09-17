import { setRequestLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
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
  const auth = await getTranslations("auth");

  return (
    <div className="flex min-h-screen flex-col"><SiteHeader active="login"/><div className="page-shell flex flex-1 items-center justify-center py-10 sm:py-16">
      <section className="surface-card w-full max-w-[34rem] p-5 sm:p-8"><p className="eyebrow">{auth("accessByCode")}</p><h1 className="mt-2 text-3xl sm:text-4xl">{t("login")}</h1><p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-muted">{auth("loginIntro")}</p>
      <OtpLoginForm
        requestAction={requestOwnerOtpAction}
        verifyAction={verifyOwnerOtpAction}
        showFullName
        showEmailField
      />
      </section></div><SiteFooter/></div>
  );
}
