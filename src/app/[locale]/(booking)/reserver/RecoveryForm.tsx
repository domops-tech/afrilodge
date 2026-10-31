"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { requestRecoveryOtp, verifyRecoveryOtp } from "./actions";

const alertClass = "border border-danger bg-danger-soft px-4 py-3 text-sm text-danger";

export function RecoveryForm({ locale, returnTo }: { locale: string; returnTo: string }) {
  const t = useTranslations("booking");
  const [request, send, sending] = useActionState(requestRecoveryOtp, { status: "idle" });
  const [verification, verify, verifying] = useActionState(verifyRecoveryOtp, { status: "idle" });
  const [editing, setEditing] = useState(false);
  const showCode = request.status === "sent" && !editing;
  return <div className="flex flex-col gap-5">
    {!showCode ? <form action={async data => { setEditing(false); await send(data); }} className="flex flex-col gap-5">
      <Field id="phone" name="phone" type="tel" autoComplete="tel" label={t("phoneLabel")} placeholder={t("phonePlaceholder")} required className="min-h-12" />
      {request.status === "error" ? <p role="alert" className={alertClass}>{t(request.message ?? "invalid")}</p> : null}
      <Button className="!min-h-12" disabled={sending}>{t("sendCode")}</Button>
    </form> : <form action={verify} className="flex flex-col gap-5">
      <p className="font-serif text-lg leading-snug">{t("codeSent", { phone: request.phone ?? "" })}</p>
      <input type="hidden" name="phone" value={request.phone} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Field id="code" name="code" label={t("codeLabel")} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required className="min-h-12" />
      {verification.status === "error" ? <p role="alert" className={alertClass}>{t(verification.message ?? "invalid")}</p> : null}
      <Button className="!min-h-12" disabled={verifying}>{t("recoverCta")}</Button>
      <button type="button" onClick={() => setEditing(true)} className="quiet-link self-start text-sm text-foreground underline underline-offset-4">{t("changeNumber")}</button>
    </form>}
  </div>;
}
