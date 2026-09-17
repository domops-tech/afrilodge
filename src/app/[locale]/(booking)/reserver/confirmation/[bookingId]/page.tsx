import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { requireGuestSession } from "@/lib/auth/guard";
import { hasArrivalDateStarted } from "@/lib/booking/arrival";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { confirmArrivalAction, cancelBookingAction, reportDisputeAction } from "./actions";

/**
 * Écran de suivi de la demande (CDC §6.2, épics 5.4, 6.1-6.5) : accessible
 * tant que la session voyageur éphémère est valide (src/lib/auth/guard.ts).
 * L’accès est limité au téléphone prouvé par OTP, y compris après une
 * récupération de session ou une seconde réservation.
 */
export default async function BookingConfirmationPage({
  params,
  searchParams,
}: PageProps<"/[locale]/reserver/confirmation/[bookingId]">) {
  const { locale, bookingId } = await params;
  const { erreur } = await searchParams;
  setRequestLocale(locale);
  const session = await requireGuestSession(`/reserver/confirmation/${bookingId}`);
  const t = await getTranslations("booking");
  const format = await getFormatter();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { guestSession: { select: { phone: true } },
      property: { select: { title: true, neighborhood: true, city: true, verification: true } },
      payment: true,
      dispute: true,
    },
  });

  if (!booking || booking.guestSession.phone !== session.phone) {
    notFound();
  }

  const canCancelFreely = booking.status === "REQUESTED" || booking.status === "ACCEPTED";
  const canCancelWithPolicy = booking.status === "PAID";

  return (
    <div className="flex min-h-screen flex-col"><SiteHeader active="bookings"/><div className="page-shell flex-1 py-7 sm:py-10">
      <div className="mx-auto max-w-[900px]">
        <Link href="/reserver" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted hover:text-verified"><span aria-hidden="true">←</span>{t("myBookings")}</Link>
        <div className="mt-3"><p className="eyebrow">{t("bookingReference")}</p><h1 className="mt-2 text-[clamp(2.15rem,4vw,3.75rem)] leading-tight">{t("confirmationTitle")}</h1></div>
        {booking.status === "REQUESTED" ? <div className="mt-5 flex items-start gap-3 rounded-[var(--radius)] border border-[#ddcaa3] bg-[#fbf5e9] p-4 sm:p-5"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#e9dcc0] font-semibold text-[#6b532a]" aria-hidden="true">1</span><div><p className="font-semibold text-[#493d28]">{t("hostResponse")}</p><p className="mt-1 text-sm leading-relaxed text-[#615641]">{t("statusRequested")}</p></div></div> : null}
        {booking.status === "ACCEPTED" && booking.payment ? <div className="mt-5 flex items-start gap-3 rounded-[var(--radius)] border border-verified/20 bg-verified-soft p-4 sm:p-5"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-verified font-semibold text-white" aria-hidden="true">✓</span><div><p className="font-semibold text-verified">{t("statusAccepted")}</p><p className="mt-1 text-sm leading-relaxed text-muted">{t("acceptedPaymentHint")}</p></div></div> : null}
        {booking.status === "PAID" || booking.status === "IN_PROGRESS" ? <div className="mt-5 flex items-start gap-3 rounded-[var(--radius)] border border-verified/20 bg-verified-soft p-4 sm:p-5"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-verified font-semibold text-white" aria-hidden="true">✓</span><div><p className="font-semibold text-verified">{t("paymentConfirmation")}</p><p className="mt-1 text-sm leading-relaxed text-muted">{booking.status === "IN_PROGRESS" ? t("statusInProgress") : t("statusPaid")}</p></div></div> : null}
        {typeof erreur === "string" ? <p role="alert" className="mt-4 rounded-[var(--radius)] border border-danger/25 bg-red-50 p-3 text-sm text-danger">{t(`error.${erreur}`)}</p> : null}
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <Card className="flex flex-col gap-4 p-4 sm:p-6">
            <div><p className="eyebrow">{t("yourStay")}</p><h2 className="mt-1 text-2xl leading-tight">{booking.property.title}</h2><p className="mt-1 text-sm text-muted">{booking.property.neighborhood} · {booking.property.city}</p></div>
            {booking.property.verification ? <VerifiedBadge verification={booking.property.verification} compact/> : null}
            <div className="grid grid-cols-2 gap-3 border-y border-border py-4 text-sm"><div><p className="text-xs font-medium text-muted">{t("checkInLabel")}</p><p className="mt-1 font-medium">{format.dateTime(booking.checkIn,{dateStyle:"medium"})}</p></div><div><p className="text-xs font-medium text-muted">{t("checkOutLabel")}</p><p className="mt-1 font-medium">{format.dateTime(booking.checkOut,{dateStyle:"medium"})}</p></div><div><p className="text-xs font-medium text-muted">{t("guestsLabel")}</p><p className="mt-1 font-medium">{t("guestsCount",{count:booking.guests})}</p></div><div><p className="text-xs font-medium text-muted">{t("totalLabel")}</p><p className="mt-1 font-semibold tabular-nums">{format.number(booking.totalAmount)} FCFA</p></div></div>
            {booking.status === "ACCEPTED" && booking.payment ? <div className="flex flex-col gap-2"><Link href={`/reserver/paiement/${booking.id}`} className={buttonClassName("primary","w-full")}>{t("payNowCta")}<span aria-hidden="true">→</span></Link><p className="text-xs leading-relaxed text-muted">{t("paymentSimulatorNotice")}</p></div>:null}
            {(booking.status === "PAID" || booking.status === "IN_PROGRESS") ? <div className="rounded-[.8rem] bg-verified-soft p-3.5"><p className="text-sm font-medium text-verified">{t("stayCodeLabel",{code:booking.stayCode})}</p>{booking.accessInfo ? <p className="mt-2 text-sm leading-relaxed text-foreground">{booking.accessInfo}</p>:null}</div>:null}
            {booking.status === "CANCELLED" ? <p className="rounded-[.8rem] bg-red-50 p-3.5 text-sm text-danger">{t("statusCancelled")}</p>:null}
          </Card>
          <aside className="flex flex-col gap-3 rounded-[var(--radius)] bg-surface-alt/65 p-4 sm:p-5"><h2 className="text-xl">{t("actionsTitle")}</h2>
            {booking.status === "PAID" && !hasArrivalDateStarted(booking.checkIn) ? <p className="text-sm leading-relaxed text-muted">{t("arrivalAvailableOn",{date:format.dateTime(booking.checkIn,{dateStyle:"long"})})}</p>:null}
            {booking.status === "PAID" && hasArrivalDateStarted(booking.checkIn) ? <form action={confirmArrivalAction}><input type="hidden" name="bookingId" value={booking.id}/><input type="hidden" name="locale" value={locale}/><Button type="submit" className="w-full">{t("confirmArrivalCta")}</Button></form>:null}
            {booking.status === "IN_PROGRESS" ? booking.dispute ? <div className="flex flex-col gap-1 text-sm"><span className="font-medium">{t("disputeTitle")}</span><span className="text-muted">{t(`disputeStatus.${booking.dispute.status}`)}</span>{booking.dispute.resolutionNote?<span>{booking.dispute.resolutionNote}</span>:null}</div>:<form action={reportDisputeAction} className="flex flex-col gap-3"><input type="hidden" name="bookingId" value={booking.id}/><input type="hidden" name="locale" value={locale}/><Field id="reason" name="reason" label={t("reportDisputeLabel")} required/><Button type="submit" variant="secondary" className="w-full">{t("reportDisputeCta")}</Button></form>:null}
            {canCancelFreely || canCancelWithPolicy ? <form action={cancelBookingAction}><input type="hidden" name="bookingId" value={booking.id}/><input type="hidden" name="locale" value={locale}/><Button type="submit" variant="secondary" className="w-full">{t("cancelCta")}</Button></form>:null}
            <Link href={`/logements/${booking.propertyId}`} className="inline-flex min-h-11 items-center text-sm font-medium text-verified underline underline-offset-4">{t("propertyLink")}</Link>
          </aside>
        </div>
      </div>
    </div><SiteFooter/></div>
  );
}
