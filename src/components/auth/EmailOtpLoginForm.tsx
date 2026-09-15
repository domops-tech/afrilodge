"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { EmailOtpState } from "@/app/[locale]/(admin)/admin/connexion/actions";

export function EmailOtpLoginForm({
  requestAction,
  verifyAction,
}: {
  requestAction: (prev: EmailOtpState, data: FormData) => Promise<EmailOtpState>;
  verifyAction: (prev: EmailOtpState, data: FormData) => Promise<EmailOtpState>;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [requestState, request, requestPending] = useActionState(async (prev: EmailOtpState, data: FormData) => {
    const result = await requestAction(prev, data);
    if (result.status === "sent") setStep("code");
    return result;
  }, { status: "idle" as const });
  const [verifyState, verify, verifyPending] = useActionState(verifyAction, { status: "idle" as const });
  const error = requestState.message ?? verifyState.message;
  const errorText = error === "rate_limited" ? t("rateLimited") : error === "not_recognized" ? t("notRecognized") : error === "expired" ? t("expiredCode") : error === "tooManyAttempts" ? t("tooManyAttempts") : t("invalidCode");

  if (step === "email") return <form action={request} className="flex w-full max-w-sm flex-col gap-4">
    <Field id="admin-email" name="email" type="email" label={t("emailLoginLabel")} placeholder={t("emailPlaceholder")} autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
    {requestState.status === "error" ? <p role="alert" className="text-sm text-danger">{errorText}</p> : null}
    <Button disabled={requestPending}>{t("sendEmailCode")}</Button>
  </form>;

  return <form action={verify} className="flex w-full max-w-sm flex-col gap-4">
    <input type="hidden" name="email" value={email} />
    <input type="hidden" name="locale" value={locale} />
    <p className="text-sm text-muted">{t("codeSentByEmail", { email })}</p>
    <Field id="admin-email-code" name="code" label={t("emailCodeLabel")} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required />
    {verifyState.status === "error" ? <p role="alert" className="text-sm text-danger">{errorText}</p> : null}
    <Button disabled={verifyPending}>{t("verify")}</Button>
    <Button type="button" variant="secondary" onClick={() => setStep("email")}>{t("requestAnotherCode")}</Button>
  </form>;
}
