import { useFormatter, useTranslations } from "next-intl";
import { isVerificationValid, type VerificationLike } from "@/lib/verification/badge";

/**
 * La mention « Vérifié sur place », avec sa date — jamais affichée sans elle
 * (CDC §4.2 : "porte une date de visite, toujours affichée au voyageur").
 * Forme de la charte : pilule indigo, cadre de porte blanc, coche ocre.
 */
export function VerifiedBadge({ verification, compact = false }: { verification: VerificationLike & { visitDate?: Date }; compact?: boolean }) {
  const t = useTranslations("verification");
  const format = useFormatter();

  if (!isVerificationValid(verification)) return null;

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-verified py-1 pl-2 pr-3.5 text-[.8125rem] font-semibold leading-none text-verified-foreground">
      <svg viewBox="0 0 24 24" fill="none" className="size-5 shrink-0" aria-hidden="true">
        <path d="M5 22V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5V22" stroke="currentColor" strokeWidth="2" />
        <path d="m8.5 14.2 2.6 2.7 4.6-5.6" stroke="var(--ocre)" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t("badge")}
      {!compact && verification.visitDate ? <span className="font-normal opacity-90">· {t("badgeVisited", { date: format.dateTime(verification.visitDate, { day: "numeric", month: "short", year: "numeric" }) })}</span> : null}
    </span>
  );
}
