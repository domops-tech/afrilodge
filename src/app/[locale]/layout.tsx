import type { Metadata } from "next";
import { Outfit, Libre_Caslon_Text } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const caslon = Libre_Caslon_Text({
  variable: "--font-caslon",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return {
    title: { default: "AyoStay", template: "%s · AyoStay" },
    description: t("tagline"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Fige la langue pour tout le rendu serveur de cette requête (RSC).
  setRequestLocale(locale);
  // Seuls ces espaces de noms sont lus par des composants client (useTranslations) :
  // le reste ne sert qu'aux pages serveur et alourdirait chaque page pour rien.
  const all = (await getMessages()) as Record<string, unknown>;
  const property = all.property as Record<string, unknown>;
  const clientMessages = {
    common: all.common,
    auth: all.auth,
    booking: all.booking,
    admin: all.admin,
    field: all.field,
    property: { gallery: property.gallery },
  };
  const common = await getTranslations("common");

  return (
    <html
      lang={locale}
      className={`${outfit.variable} ${caslon.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={clientMessages}>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:p-3">{common("skipToContent")}</a>
          <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
