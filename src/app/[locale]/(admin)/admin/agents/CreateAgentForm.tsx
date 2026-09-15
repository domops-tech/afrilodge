"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { createAgentAction, type CreateAgentState } from "./actions";

const errorKey = (message?: string) => (message === "phone_taken" ? "createAgentPhoneTaken" : "createAgentInvalid");

export function CreateAgentForm({ locale }: { locale: string }) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState<CreateAgentState, FormData>(createAgentAction, {
    status: "idle",
  });

  return (
    <form action={action} className="flex max-w-sm flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <Field id="fullName" name="fullName" label={t("agentFullNameLabel")} autoComplete="name" required />
      <Field id="phone" name="phone" label={t("agentPhoneLabel")} type="tel" autoComplete="tel" required />
      <Field id="email" name="email" label={t("agentEmailLabel")} type="email" autoComplete="email" required />
      <p className="text-xs text-muted">{t("agentEmailHint")}</p>
      {state.status === "error" ? (
        <p className="text-sm text-danger">{t(errorKey(state.message))}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="self-start">
        {t("createAgentCta")}
      </Button>
    </form>
  );
}
