"use client";

import { useActionState, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { requestOwnerOtpAction, verifyOwnerOtpAction } from "./actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const requestErrorKey = (message?: string) =>
  message === "rate_limited" ? "rateLimited" : "invalidCode";

const verifyErrorKey = (message?: string) => {
  switch (message) {
    case "expired":
      return "expiredCode";
    case "too_many_attempts":
      return "tooManyAttempts";
    default:
      return "invalidCode";
  }
};

export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");

  const [requestState, requestAction, requestPending] = useActionState(
    async (prev: Awaited<ReturnType<typeof requestOwnerOtpAction>>, formData: FormData) => {
      const result = await requestOwnerOtpAction(prev, formData);
      if (result.status === "sent") setStep("code");
      return result;
    },
    { status: "idle" as const }
  );

  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyOwnerOtpAction,
    { status: "idle" as const }
  );

  if (step === "phone") {
    return (
      <form action={requestAction} className="flex w-full max-w-sm flex-col gap-4">
        <Field
          id="phone"
          name="phone"
          label={t("phoneLabel")}
          placeholder={t("phonePlaceholder")}
          type="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {requestState.status === "error" ? (
          <p className="text-sm text-danger">{t(requestErrorKey(requestState.message))}</p>
        ) : null}
        <Button type="submit" disabled={requestPending}>
          {t("sendCode")}
        </Button>
      </form>
    );
  }

  return (
    <form action={verifyAction} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="locale" value={locale} />
      <p className="text-sm text-muted">{t("codeSent", { phone })}</p>
      <Field id="fullName" name="fullName" label={t("fullNameLabel")} autoComplete="name" />
      <Field
        id="code"
        name="code"
        label={t("codeLabel")}
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        autoComplete="one-time-code"
        required
      />
      {verifyState.status === "error" ? (
        <p className="text-sm text-danger">{t(verifyErrorKey(verifyState.message))}</p>
      ) : null}
      <Button type="submit" disabled={verifyPending}>
        {t("verify")}
      </Button>
    </form>
  );
}
