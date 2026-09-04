"use server";

import { prisma } from "@/lib/db/client";
import { requireGuestSession } from "@/lib/auth/guard";
import { redirect } from "@/i18n/navigation";
import { simulateGuestPayment, buildSimulatedWebhookRequest } from "@/lib/payments/simulated";
import { processPaymentWebhook } from "@/lib/payments/webhook-handler";

/**
 * Simule le voyageur qui complète le paiement sur ses propres canaux
 * Mobile Money (CDC §6.2.3, épic 6.2) tant que le §12 n'est pas tranché.
 * Ne modifie jamais l'état du paiement directement : marque le simulateur
 * « payé » côté PSP puis fait suivre le même webhook signé qu'un PSP réel
 * enverrait — voir src/lib/payments/webhook-handler.ts.
 */
export async function simulatePaymentAction(formData: FormData): Promise<void> {
  const session = await requireGuestSession();
  const bookingId = String(formData.get("bookingId"));
  const locale = (formData.get("locale") as string) || "fr";

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { payment: true } });
  if (!booking || booking.guestSessionId !== session.guestSessionId || !booking.payment) {
    return redirect({ href: `/reserver/confirmation/${bookingId}?erreur=etat-invalide`, locale });
  }

  if (booking.status !== "ACCEPTED" || booking.payment.status !== "INTENT_CREATED") {
    return redirect({ href: `/reserver/confirmation/${bookingId}?erreur=etat-invalide`, locale });
  }

  simulateGuestPayment(booking.payment.providerIntentRef);
  const { rawBody, signature } = buildSimulatedWebhookRequest({
    type: "funds.held",
    providerIntentRef: booking.payment.providerIntentRef,
  });
  await processPaymentWebhook(rawBody, signature);

  return redirect({ href: `/reserver/confirmation/${bookingId}`, locale });
}
