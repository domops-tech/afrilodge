"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { requestRecoveryOtp, verifyRecoveryOtp } from "./actions";

export function RecoveryForm({ locale, returnTo }: { locale: string; returnTo: string }) {
  const t = useTranslations("booking");
  const [request, send, sending] = useActionState(requestRecoveryOtp, { status: "idle" });
  const [verification, verify, verifying] = useActionState(verifyRecoveryOtp, { status: "idle" });
  const [editing, setEditing] = useState(false);
  const showCode = request.status === "sent" && !editing;
  return <div className="flex max-w-sm flex-col gap-4">
    {!showCode ? <form action={async data => { setEditing(false); await send(data); }} className="flex flex-col gap-4">
      <Field id="phone" name="phone" type="tel" autoComplete="tel" label={t("phoneLabel")} required />
      {request.status === "error" ? <p role="alert">{t(request.message ?? "invalid")}</p> : null}
      <Button disabled={sending}>{t("sendCode")}</Button>
    </form> : <form action={verify} className="flex flex-col gap-4">
      <p>{t("codeSent", { phone: request.phone ?? "" })}</p>
      <input type="hidden" name="phone" value={request.phone} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Field id="code" name="code" label={t("codeLabel")} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required />
      {verification.status === "error" ? <p role="alert">{t(verification.message ?? "invalid")}</p> : null}
      <Button disabled={verifying}>{t("recoverCta")}</Button>
      <Button type="button" variant="secondary" onClick={() => setEditing(true)}>{t("requestAnotherCode")}</Button>
    </form>}
  </div>;
}
