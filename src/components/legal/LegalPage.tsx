import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

type Section = { title: string; body: string };

export async function LegalPage({ locale, page }: { locale: string; page: "notice" | "terms" | "privacy" }) {
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  const sections = t.raw(`pages.${page}.sections`) as Section[];
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">
        <article className="page-shell py-14 sm:py-20">
          <div className="max-w-[46rem]">
            <h1 className="t-display">{t(`pages.${page}.title`)}</h1>
            <p className="lede mt-4 text-muted">{t(`pages.${page}.intro`)}</p>
            <p role="note" className="mt-8 border border-ocre/60 bg-ocre/10 px-4 py-3 text-sm leading-relaxed">{t("provisional")}</p>
            <div className="mt-10 divide-y divide-border border-y border-border">
              {sections.map((section) => (
                <section key={section.title} className="py-7">
                  <h2 className="t-3">{section.title}</h2>
                  <p className="mt-2 leading-relaxed text-muted">{section.body}</p>
                </section>
              ))}
            </div>
          </div>
        </article>
      </div>
      <SiteFooter />
    </div>
  );
}
