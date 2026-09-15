"use server";
import { prisma } from "@/lib/db/client";
import { phoneSchema } from "@/lib/auth/login-flow";
import { requestOtp, verifyOtp, OtpRateLimitError } from "@/lib/auth/otp";
import { createGuestSession } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";

export type RecoveryState = { status: "idle" | "sent" | "error"; phone?: string; message?: string };
export async function requestRecoveryOtp(_state: RecoveryState, data: FormData): Promise<RecoveryState> {
  const parsed = phoneSchema.safeParse(data.get("phone"));
  if (!parsed.success) return { status: "error", message: "invalid" };
  const phone = parsed.data.replace(/\s+/g, "");
  try {
    // Send only to the phone. Never disclose whether a reservation exists.
    await requestOtp({ phone, purpose: "GUEST_ACCESS" });
  } catch (error) {
    if (error instanceof OtpRateLimitError) return { status: "error", message: "rateLimited" };
    throw error;
  }
  return { status: "sent", phone };
}
export async function verifyRecoveryOtp(_state: RecoveryState, data: FormData): Promise<RecoveryState> {
  const parsed = phoneSchema.safeParse(data.get("phone"));
  if (!parsed.success) return { status: "error", message: "invalid" };
  const phone = parsed.data.replace(/\s+/g, "");
  const result = await verifyOtp({ phone, purpose: "GUEST_ACCESS", code: String(data.get("code") ?? "").trim() });
  if (!result.ok) return { status: "error", message: "invalidCode" };
  const guest = await prisma.guestSession.findFirst({ where: { phone }, orderBy: { createdAt: "desc" } });
  if (!guest) return { status: "error", message: "noBookings" };
  await createGuestSession(guest.id);
  const returnTo = String(data.get("returnTo") ?? "");
  // Only accept a local confirmation destination, never an external redirect.
  const href = /^\/reserver\/confirmation\/[a-zA-Z0-9_-]+$/.test(returnTo) ? returnTo : "/reserver";
  return redirect({ href, locale: data.get("locale") === "en" ? "en" : "fr" });
}
