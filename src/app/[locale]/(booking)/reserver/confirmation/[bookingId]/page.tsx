import { nbsp } from "@/lib/format/nbsp";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { PropertyImage } from "@/components/property/PropertyImage";
import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { requireGuestSession } from "@/lib/auth/guard";
import { hasArrivalDateStarted } from "@/lib/booking/arrival";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
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
  const hasAccess = booking.status === "PAID" || booking.status === "IN_PROGRESS";
  const nights = Math.max(1, Math.round((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000));
  const cover = await prisma.visitPhoto.findFirst({
    where: { slot: "FACADE", visit: { verification: { propertyId: booking.propertyId } } },
    select: { storageKey: true, isDemoPlaceholder: true },
  });
  const day = (date: Date) => format.dateTime(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const alertClass = "mt-6 border border-danger bg-danger-soft px-4 py-3 text-sm text-danger";
  const row = "flex items-baseline justify-between gap-6 py-4";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader active="bookings" />
      <div className="flex-1">
        <div className="page-shell py-10 sm:py-14">
          <Link href="/reserver" className="quiet-link inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted hover:text-foreground"><span aria-hidden="true">←</span>{t("myBookings")}</Link>
          <div className="mt-6 grid gap-14 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-24">
            <div>
              <h1 className="t-hero">{t(`title.${booking.status}`)}</h1>
              <p className="lede mt-5 max-w-[46ch] text-muted">{t(`next.${booking.status}`)}</p>
              {typeof erreur === "string" ? <p role="alert" className={alertClass}>{t(`error.${erreur}`)}</p> : null}

              {booking.status === "ACCEPTED" && booking.payment ? (
                <div className="mt-8 max-w-[28rem]">
                  <Link href={`/reserver/paiement/${booking.id}`} className={buttonClassName("primary", "!min-h-12 w-full")}>{t("payNowCta")}</Link>
                  <p className="mt-3 text-xs leading-relaxed text-muted">{t("paymentSimulatorNotice")}</p>
                </div>
              ) : null}

              {hasAccess ? (
                <div className="mt-10 border border-foreground p-6 sm:p-8">
                  <p className="caps !text-[.625rem] text-muted">{t("stayCode")}</p>
                  <p className="mt-2 font-serif text-4xl tracking-[.14em] tabular-nums sm:text-5xl">{booking.stayCode}</p>
                  {booking.accessInfo ? (
                    <>
                      <p className="caps mt-7 !text-[.625rem] text-muted">{t("accessTitle")}</p>
                      <p className="mt-2 max-w-[52ch] leading-relaxed">{booking.accessInfo}</p>
                    </>
                  ) : null}
                </div>
              ) : null}

              <dl className="mt-12 divide-y divide-border border-y border-border">
                <div className={row}><dt className="text-sm text-muted">{t("checkInLabel")}</dt><dd className="text-right font-serif text-lg first-letter:uppercase">{day(booking.checkIn)}</dd></div>
                <div className={row}><dt className="text-sm text-muted">{t("checkOutLabel")}</dt><dd className="text-right font-serif text-lg first-letter:uppercase">{day(booking.checkOut)}</dd></div>
                <div className={row}><dt className="text-sm text-muted">{t("guestsLabel")}</dt><dd className="text-right font-serif text-lg">{t("stayLength", { nights, guests: booking.guests })}</dd></div>
                <div className={row}><dt className="text-sm text-muted">{t("totalLabel")}</dt><dd className="text-right font-serif text-lg tabular-nums">{nbsp(format.number(booking.totalAmount))} FCFA</dd></div>
              </dl>

              <section className="mt-12" aria-labelledby="manage-heading">
                <h2 id="manage-heading" className="t-3">{t("actionsTitle")}</h2>
                <div className="mt-5 flex max-w-[28rem] flex-col gap-4">
                  {booking.status === "PAID" && !hasArrivalDateStarted(booking.checkIn) ? <p className="text-sm leading-relaxed text-muted">{t("arrivalAvailableOn", { date: format.dateTime(booking.checkIn, { dateStyle: "long" }) })}</p> : null}
                  {booking.status === "PAID" && hasArrivalDateStarted(booking.checkIn) ? <form action={confirmArrivalAction}><input type="hidden" name="bookingId" value={booking.id} /><input type="hidden" name="locale" value={locale} /><Button type="submit" className="!min-h-12 w-full">{t("confirmArrivalCta")}</Button></form> : null}
                  {booking.status === "IN_PROGRESS" ? (
                    booking.dispute ? (
                      <div className="border border-border p-4 text-sm"><p className="font-medium">{t("disputeTitle")}</p><p className="mt-1 text-muted">{t(`disputeStatus.${booking.dispute.status}`)}</p>{booking.dispute.resolutionNote ? <p className="mt-2">{booking.dispute.resolutionNote}</p> : null}</div>
                    ) : (
                      <form action={reportDisputeAction} className="flex flex-col gap-4"><input type="hidden" name="bookingId" value={booking.id} /><input type="hidden" name="locale" value={locale} /><Field id="reason" name="reason" label={t("reportDisputeLabel")} required className="min-h-12" /><Button type="submit" variant="secondary" className="w-full">{t("reportDisputeCta")}</Button></form>
                    )
                  ) : null}
                  {canCancelFreely || canCancelWithPolicy ? <form action={cancelBookingAction}><input type="hidden" name="bookingId" value={booking.id} /><input type="hidden" name="locale" value={locale} /><Button type="submit" variant="secondary" className="w-full">{t("cancelCta")}</Button></form> : null}
                  <Link href={`/logements/${booking.propertyId}`} className="quiet-link inline-flex min-h-11 items-center text-sm font-medium text-foreground underline underline-offset-4">{t("propertyLink")}</Link>
                </div>
              </section>
            </div>

            <aside aria-label={booking.property.title} className="lg:self-start">
              <div className="card-photo !aspect-[4/3]">
                {cover ? <PropertyImage storageKey={cover.storageKey} isDemoPlaceholder={cover.isDemoPlaceholder} alt="" width={900} height={675} priority sizes="(min-width: 1024px) 40vw, 100vw" className="h-full w-full object-cover" /> : <div className="photo-placeholder" role="img" aria-label={booking.property.title} />}
              </div>
              <h2 className="t-2 mt-6">{booking.property.title}</h2>
              <p className="mt-1 font-serif text-lg text-muted">{booking.property.neighborhood}, {booking.property.city}</p>
              {booking.property.verification ? <div className="mt-5"><VerifiedBadge verification={booking.property.verification} compact /></div> : null}
            </aside>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
