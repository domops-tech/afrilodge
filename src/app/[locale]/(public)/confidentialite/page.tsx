import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { robots: { index: false } };

export default async function PrivacyPage({ params }: PageProps<"/[locale]/confidentialite">) {
  const { locale } = await params;
  return <LegalPage locale={locale} page="privacy" />;
}
