"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { scheduleVisitAction, type ScheduleState } from "./actions";

export function ScheduleForm({
  requestId,
  locale,
  agents,
}: {
  requestId: string;
  locale: string;
  agents: { id: string; fullName: string }[];
}) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState<ScheduleState, FormData>(scheduleVisitAction, {
    status: "idle",
  });

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="locale" value={locale} />
      <label className="flex flex-col gap-1 text-xs">
        {t("assignAgentLabel")}
        <select
          name="agentId"
          required
          className="min-h-11 rounded-[var(--radius-default)] border border-border bg-background px-2 text-sm"
        >
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.fullName}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        {t("scheduledAtLabel")}
        <input
          type="datetime-local"
          name="scheduledAt"
          required
          className="min-h-11 rounded-[var(--radius-default)] border border-border bg-background px-2 text-sm"
        />
      </label>
      <Button type="submit" variant="secondary" disabled={pending}>
        {t("scheduleCta")}
      </Button>
      {state.status === "error" ? <p className="text-xs text-danger">{t("scheduleError")}</p> : null}
    </form>
  );
}
