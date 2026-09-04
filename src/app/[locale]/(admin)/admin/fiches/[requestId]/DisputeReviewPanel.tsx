"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { confirmDiscrepancyAction, dismissDisputeAction, type DecisionState } from "./actions";

/** Décision d'une contre-visite (CDC §6.5.3, épic 7.3) — voir ./actions.ts pour pourquoi ce n'est jamais un "approuver". */
export function DisputeReviewPanel({ requestId, locale }: { requestId: string; locale: string }) {
  const t = useTranslations("admin");

  const [confirmState, confirmAction, confirmPending] = useActionState<DecisionState, FormData>(
    confirmDiscrepancyAction,
    { status: "idle" }
  );
  const [dismissState, dismissAction, dismissPending] = useActionState<DecisionState, FormData>(
    dismissDisputeAction,
    { status: "idle" }
  );

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <h2 className="font-medium">{t("disputeDecisionTitle")}</h2>

      <div className="flex gap-3">
        <form action={dismissAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" variant="secondary" disabled={confirmPending || dismissPending}>
            {t("dismissDisputeCta")}
          </Button>
        </form>
        <form action={confirmAction}>
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="locale" value={locale} />
          <Button type="submit" disabled={confirmPending || dismissPending}>
            {t("confirmDiscrepancyCta")}
          </Button>
        </form>
      </div>

      {confirmState.status === "error" || dismissState.status === "error" ? (
        <p className="text-sm text-danger">{confirmState.message ?? dismissState.message}</p>
      ) : null}
    </section>
  );
}
