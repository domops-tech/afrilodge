import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { LoginLayout } from "@/components/auth/LoginLayout";
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
  const nav = await getTranslations("nav");
  const auth = await getTranslations("auth");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader active="login" />
      <div className="page-shell flex-1 py-12 sm:py-20">
        <LoginLayout
          title={nav("owner")}
          lede={auth("owner.lede")}
          aside={
            <p className="text-muted">
              {auth("otherSpaces")}{" "}
              <Link href="/terrain/connexion" className="quiet-link font-medium text-foreground underline underline-offset-4">{nav("field")}</Link>
              {" "}/{" "}
              <Link href="/admin/connexion" className="quiet-link font-medium text-foreground underline underline-offset-4">{nav("admin")}</Link>
            </p>
          }
        >
          <OtpLoginForm requestAction={requestOwnerOtpAction} verifyAction={verifyOwnerOtpAction} showFullName showEmailField />
        </LoginLayout>
      </div>
      <SiteFooter />
    </div>
  );
}
