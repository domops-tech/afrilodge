import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { PropertyImage } from "@/components/property/PropertyImage";
import { buttonClassName } from "@/components/ui/Button";
import { nbsp } from "@/lib/format/nbsp";
import { RecoveryForm } from "./RecoveryForm";

const STATUS_STYLE: Record<string, string> = {
  REQUESTED: "border border-foreground/40 text-foreground",
  ACCEPTED: "bg-accent text-accent-foreground",
  PAID: "bg-success text-white",
  IN_PROGRESS: "bg-success text-white",
  COMPLETED: "border border-border text-muted",
  CANCELLED: "border border-border text-muted",
  DISPUTED: "border border-danger text-danger",
};
const ENDED = ["CANCELLED", "COMPLETED"];

export default async function ReservationsPage({ params, searchParams }: PageProps<"/[locale]/reserver">) {
  const { locale } = await params;
  const { retour } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("booking");
  const format = await getFormatter();
  const session = await getSession();
  const guest = session?.kind === "guest" && session.phoneVerified ? await prisma.guestSession.findUnique({ where: { id: session.guestSessionId } }) : null;
  const bookings = guest ? await prisma.booking.findMany({
    where: { guestSession: { phone: guest.phone } },
    include: { property: { select: { id: true, title: true, neighborhood: true, city: true } } },
  }) : [];

  const propertyIds = [...new Set(bookings.map(booking => booking.property.id))];
  const photos = propertyIds.length ? await prisma.visitPhoto.findMany({
    where: { slot: "FACADE", visit: { verification: { propertyId: { in: propertyIds } } } },
    select: { storageKey: true, isDemoPlaceholder: true, visit: { select: { verification: { select: { propertyId: true } } } } },
  }) : [];
  const photoByProperty = new Map(photos.map(photo => [photo.visit.verification?.propertyId, photo]));

  const today = new Date();
  const isUpcoming = (booking: (typeof bookings)[number]) => !ENDED.includes(booking.status) && booking.checkOut >= today;
  const upcoming = bookings.filter(isUpcoming).sort((a, b) => a.checkIn.getTime() - b.checkIn.getTime());
  const past = bookings.filter(booking => !isUpcoming(booking)).sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime());
  const groups = [
    { key: "upcoming", title: t("upcoming"), items: upcoming },
    { key: "past", title: t("past"), items: past },
  ].filter(group => group.items.length);

  const row = (booking: (typeof bookings)[number], index: number) => {
    const photo = photoByProperty.get(booking.property.id);
    const nights = Math.max(1, Math.round((booking.checkOut.getTime() - booking.checkIn.getTime()) / 86_400_000));
    const muted = ENDED.includes(booking.status);
    return (
      <li key={booking.id}>
        <Link href={`/reserver/confirmation/${booking.id}`} className="group grid gap-5 py-8 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,15rem)] sm:items-center sm:gap-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,16rem)] lg:gap-12">
          <div className="card-photo">
            {photo ? <PropertyImage storageKey={photo.storageKey} isDemoPlaceholder={photo.isDemoPlaceholder} alt="" width={620} height={413} priority={index === 0} sizes="(min-width: 1024px) 18rem, (min-width: 640px) 14rem, 100vw" className="h-full w-full object-cover" /> : <div className="photo-placeholder" role="img" aria-label={booking.property.title} />}
          </div>
          <div className="lg:contents">
            <div className={muted ? "opacity-75" : ""}>
              <p className="t-2">{format.dateTimeRange(booking.checkIn, booking.checkOut, { day: "numeric", month: "long", year: "numeric" })}</p>
              <p className="mt-1 text-sm text-muted">{t("stayLength", { nights, guests: booking.guests })}</p>
            </div>
            <div className={`mt-4 lg:mt-0 ${muted ? "opacity-75" : ""}`}>
              <p className="font-serif text-lg leading-snug group-hover:underline group-hover:underline-offset-4">{booking.property.title}</p>
              <p className="font-serif text-muted">{booking.property.neighborhood}, {booking.property.city}</p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end sm:text-right">
            <span className={`caps !text-[.625rem] px-3 py-1.5 ${STATUS_STYLE[booking.status] ?? ""}`}>{t(`statusShort.${booking.status}`)}</span>
            <span className="text-sm leading-snug text-muted">{t(`rowHint.${booking.status}`)}</span>
            <span className="font-medium tabular-nums">{nbsp(format.number(booking.totalAmount))} FCFA</span>
          </div>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader active="bookings" />
      <div className="flex-1">
        {guest ? (
          <section className="page-shell py-12 sm:py-16">
            <div className="flex flex-col gap-2 border-b border-foreground pb-8 sm:flex-row sm:items-end sm:justify-between">
              <h1 className="t-display">{t("myBookings")}</h1>
              {bookings.length ? <p className="text-muted">{t("bookingsCount", { count: bookings.length })}</p> : null}
            </div>
            {bookings.length ? (
              <div className="mt-2">
                {groups.map(group => (
                  <section key={group.key} aria-label={group.title} className="mt-8 first:mt-4">
                    {groups.length > 1 ? <h2 className="t-3 mt-6">{group.title}</h2> : null}
                    <ul className="mt-2 divide-y divide-border border-b border-border">{group.items.map(row)}</ul>
                  </section>
                ))}
              </div>
            ) : (
              <div className="mt-12 max-w-[34rem]">
                <h2 className="t-2">{t("emptyTitle")}</h2>
                <p className="lede mt-3 text-muted">{t("emptyBody")}</p>
                <Link href="/recherche" className={buttonClassName("primary", "mt-8")}>{t("browse")}</Link>
              </div>
            )}
          </section>
        ) : (
          <section className="page-shell grid gap-10 py-12 sm:py-20 lg:grid-cols-2 lg:gap-24">
            <div>
              <h1 className="t-hero">{t("myBookings")}</h1>
              <p className="lede mt-6 max-w-[42ch] text-muted">{t("recoveryHint")}</p>
              <Link href="/recherche" className="quiet-link mt-8 inline-block font-medium text-foreground underline underline-offset-4">{t("backToSearch")}</Link>
            </div>
            <div className="bg-surface p-6 sm:p-10 lg:self-start">
              <RecoveryForm locale={locale} returnTo={typeof retour === "string" ? retour : ""} />
            </div>
          </section>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
