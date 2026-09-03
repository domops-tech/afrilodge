import { useFormatter, useTranslations } from "next-intl";
import { isVerificationValid, type VerificationLike } from "@/lib/verification/badge";

/**
 * La mention « Vérifié », avec sa date — jamais affichée sans elle
 * (CDC §4.2 : "porte une date de visite, toujours affichée au voyageur").
 */
export function VerifiedBadge({ verification }: { verification: VerificationLike }) {
  const t = useTranslations("verification");
  const format = useFormatter();

  if (!isVerificationValid(verification)) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-verified px-3 py-1 text-xs font-semibold text-verified-foreground">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
          clipRule="evenodd"
        />
      </svg>
      {t("badge")}
      <span className="font-normal opacity-90">
        · {format.dateTime(verification.expiresAt, { day: "2-digit", month: "short", year: "numeric" })}
      </span>
    </span>
  );
}
