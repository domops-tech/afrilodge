import { useFormatter, useTranslations } from "next-intl";
import type { VerificationLike } from "@/lib/verification/badge";

export function VerificationNote({ verification, compact = false }: { verification: VerificationLike & { visitDate: Date }; compact?: boolean }) {
  const t = useTranslations("verification");
  const format = useFormatter();
  return (
    <details className="group surface-card-plain">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--radius)] p-4 marker:hidden focus-visible:outline-offset-[-3px] [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-verified-soft text-verified"><svg viewBox="0 0 20 20" fill="none" className="size-5" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d="m5 10 3.2 3.2L15.5 6"/><circle cx="10" cy="10" r="8.25"/></svg></span>
          <span className="flex flex-col gap-0.5 text-left"><span className="text-sm font-semibold text-foreground">{t("explainerTitle")}</span>{!compact ? <span className="text-xs text-muted">{t("teamVisitDate", { date: format.dateTime(verification.visitDate, { dateStyle: "medium" }) })}</span> : null}</span>
        </span>
        <svg viewBox="0 0 20 20" fill="none" className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m5 7 5 5 5-5"/></svg>
      </summary>
      <div className="border-t border-border px-4 pb-4 pt-3 text-sm leading-relaxed text-muted">
        <p>{t("explainerBody")}</p>
        <p className="mt-2">{t("validUntil", { date: format.dateTime(verification.expiresAt, { dateStyle: "long" }) })}</p>
      </div>
    </details>
  );
}
