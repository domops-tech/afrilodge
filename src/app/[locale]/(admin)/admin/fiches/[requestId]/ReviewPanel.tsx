"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { approveVerificationAction, rejectVerificationAction, type DecisionState } from "./actions";

export function ReviewPanel({ requestId, locale }: { requestId: string; locale: string }) {
  const t = useTranslations("admin");
  const [showReject, setShowReject] = useState(false);

  const [approveState, approveAction, approvePending] = useActionState<DecisionState, FormData>(
    approveVerificationAction,
    { status: "idle" }
  );
  const [rejectState, rejectAction, rejectPending] = useActionState<DecisionState, FormData>(
    rejectVerificationAction,
    { status: "idle" }
  );

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <h2 className="font-medium">{t("decisionTitle")}</h2>

      {!showReject ? (
        <div className="flex gap-3">
          <form action={approveAction}>
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" disabled={approvePending || rejectPending}>
              {t("approve")}
            </Button>
          </form>
          <Button variant="secondary" onClick={() => setShowReject(true)} disabled={approvePending}>
            {t("reject")}
          </Button>
        </div>
      ) : (
        <form action={rejectAction} className="flex flex-col gap-3">
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="locale" value={locale} />
          <Field id="reason" name="reason" label={t("rejectReasonLabel")} required />
          {rejectState.status === "error" ? (
            <p className="text-sm text-danger">{t("reasonRequired")}</p>
          ) : null}
          <div className="flex gap-3">
            <Button type="submit" variant="secondary" disabled={rejectPending}>
              {t("reject")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowReject(false)}>
              {t("backToQueue")}
            </Button>
          </div>
        </form>
      )}

      {approveState.status === "error" ? <p className="text-sm text-danger">{approveState.message}</p> : null}
    </section>
  );
}
