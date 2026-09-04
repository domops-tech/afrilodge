"use server";

import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { redirect } from "@/i18n/navigation";
import { setSetting, COMMISSION_RATE_KEY, FULL_REFUND_WINDOW_DAYS_KEY } from "@/lib/settings";

const settingsSchema = z.object({
  commissionRatePercent: z.coerce.number().min(0).max(100),
  fullRefundWindowDays: z.coerce.number().int().min(0),
});

/** Politique globale paramétrable (CDC §6.5.4, §8.7) — jamais modifiable par le propriétaire. */
export async function updateSettingsAction(formData: FormData): Promise<void> {
  await requireRole("ADMIN");
  const locale = (formData.get("locale") as string) || "fr";

  const parsed = settingsSchema.safeParse({
    commissionRatePercent: formData.get("commissionRatePercent"),
    fullRefundWindowDays: formData.get("fullRefundWindowDays"),
  });
  if (!parsed.success) {
    return redirect({ href: "/admin/parametres?erreur=invalide", locale });
  }

  await setSetting(COMMISSION_RATE_KEY, String(parsed.data.commissionRatePercent / 100));
  await setSetting(FULL_REFUND_WINDOW_DAYS_KEY, String(parsed.data.fullRefundWindowDays));

  return redirect({ href: "/admin/parametres", locale });
}
