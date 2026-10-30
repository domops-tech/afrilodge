import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { requireGuestSession } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/Button";
import { nbsp } from "@/lib/format/nbsp";
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
  const format = await getFormatter();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { guestSession: { select: { phone: true } }, property: { select: { title: true, neighborhood: true, city: true } }, payment: true },
  });

  if (!booking || booking.guestSession.phone !== session.phone) notFound();
  if (booking.status !== "ACCEPTED" || !booking.payment || booking.payment.status !== "INTENT_CREATED") {
    notFound();
  }

  const day = (date: Date) => format.dateTime(date, { dateStyle: "medium" });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader active="bookings" />
      <div className="page-shell flex-1 py-7 sm:py-10">
        <div className="mx-auto max-w-[34rem]">
          <Link href={`/reserver/confirmation/${booking.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted hover:text-accent">
            <span aria-hidden="true">←</span>{t("backToBooking")}
          </Link>
          <h1 className="t-1 mt-3">{t("paymentTitle")}</h1>

          <div className="surface-card mt-6 p-5 sm:p-6">
            <p className="t-3">{booking.property.title}</p>
            <p className="mt-1 text-sm text-muted">{booking.property.neighborhood} · {booking.property.city}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
              <div><dt className="text-xs font-medium text-muted">{t("checkInLabel")}</dt><dd className="mt-1 font-medium">{day(booking.checkIn)}</dd></div>
              <div><dt className="text-xs font-medium text-muted">{t("checkOutLabel")}</dt><dd className="mt-1 font-medium">{day(booking.checkOut)}</dd></div>
            </dl>
            <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-border pt-4">
              <span className="text-sm font-medium text-muted">{t("paymentAmountLabel")}</span>
              <span className="text-2xl font-semibold tabular-nums">{t("paymentAmount", { amount: nbsp(format.number(booking.payment.amount)) })}</span>
            </div>
          </div>

          <p role="note" className="mt-4 rounded-[var(--radius)] border border-ocre/40 bg-ocre/10 px-4 py-3 text-sm leading-relaxed">{t("paymentSimulatorNotice")}</p>

          <form action={simulatePaymentAction} className="mt-5 flex flex-col gap-3">
            <input type="hidden" name="bookingId" value={booking.id} />
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" className="!min-h-12 w-full">{t("paymentCta")}</Button>
          </form>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
