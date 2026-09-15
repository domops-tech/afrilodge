import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { requireGuestSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { simulatePaymentAction } from "./actions";

/**
 * Redirection vers l'établissement de paiement (CDC §6.2.3, épic 6.2).
 * Tant que le §12 n'est pas tranché, cette page tient lieu d'écran du PSP
 * agréé — brancher le PSP réel remplacera son bouton par une vraie
 * redirection externe, sans changer le reste du tunnel (voir décision
 * 0002).
 */
export default async function PaymentPage({
  params,
}: PageProps<"/[locale]/reserver/paiement/[bookingId]">) {
  const { locale, bookingId } = await params;
  setRequestLocale(locale);
  const session = await requireGuestSession(`/reserver/confirmation/${bookingId}`);
  const t = await getTranslations("booking");

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { guestSession: { select: { phone: true } }, property: { select: { title: true } }, payment: true },
  });

  if (!booking || booking.guestSession.phone !== session.phone) notFound();
  if (booking.status !== "ACCEPTED" || !booking.payment || booking.payment.status !== "INTENT_CREATED") {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-semibold">{t("paymentTitle")}</h1>

      <Card className="flex flex-col gap-2 text-sm">
        <span className="font-medium">{booking.property.title}</span>
        <span className="text-lg font-semibold">{t("paymentAmount", { amount: booking.payment.amount })}</span>
        <span className="text-xs text-muted">{t("paymentSimulatorNotice")}</span>
      </Card>

      <form action={simulatePaymentAction} className="flex flex-col gap-3">
        <input type="hidden" name="bookingId" value={booking.id} />
        <input type="hidden" name="locale" value={locale} />
        <Button type="submit">{t("paymentCta")}</Button>
      </form>
    </div>
  );
}
