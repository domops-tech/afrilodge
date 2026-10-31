import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { robots: { index: false } };

export default async function NoticePage({ params }: PageProps<"/[locale]/mentions-legales">) {
  const { locale } = await params;
  return <LegalPage locale={locale} page="notice" />;
}
