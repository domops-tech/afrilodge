import { prisma } from "@/lib/db/client";

/**
 * Politique globale paramétrable en back-office (CDC §6.5.4, §8.7),
 * jamais modifiable par le propriétaire — décision prise avec vous à la
 * planification du Sprint 6. Deux réglages en v1, avec des valeurs par
 * défaut si l'admin n'a encore rien enregistré.
 */

export const COMMISSION_RATE_KEY = "commissionRate";
export const FULL_REFUND_WINDOW_DAYS_KEY = "fullRefundWindowDays";

export const DEFAULT_COMMISSION_RATE = 0.12;
export const DEFAULT_FULL_REFUND_WINDOW_DAYS = 2;

async function readSetting(key: string): Promise<string | null> {
  const row = await prisma.platformSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/** Taux de commission prélevé sur le propriétaire (CDC §6.5.4), ex. 0.12 = 12 %. */
export async function getCommissionRate(): Promise<number> {
  const raw = await readSetting(COMMISSION_RATE_KEY);
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_COMMISSION_RATE;
}

/** Nombre de jours avant l'arrivée en-deçà duquel une annulation n'est plus remboursée (CDC §8.7). */
export async function getFullRefundWindowDays(): Promise<number> {
  const raw = await readSetting(FULL_REFUND_WINDOW_DAYS_KEY);
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_FULL_REFUND_WINDOW_DAYS;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
