import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
  const common = await getTranslations("common");

  return (
    <html
      lang={locale}
      className={`${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:p-3">{common("skipToContent")}</a>
          <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
