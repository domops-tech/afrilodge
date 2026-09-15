import { setRequestLocale, getTranslations, getFormatter } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { Link } from "@/i18n/navigation";
import { RecoveryForm } from "./RecoveryForm";

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
    include: { property: { select: { title: true } } }, orderBy: { createdAt: "desc" },
  }) : [];
  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
    <h1 className="text-xl font-semibold">{t("myBookings")}</h1>
    {guest ? <ul className="flex flex-col gap-4">{bookings.map(booking => <li key={booking.id}>
      <Link className="block rounded-xl border border-border p-4 text-accent" href={`/reserver/confirmation/${booking.id}`}>
        {booking.property.title} · {format.dateTime(booking.checkIn, { dateStyle: "medium" })} → {format.dateTime(booking.checkOut, { dateStyle: "medium" })}
      </Link>
    </li>)}</ul> : <><p>{t("recoveryHint")}</p><RecoveryForm locale={locale} returnTo={typeof retour === "string" ? retour : ""} /></>}
    <Link href="/recherche" className="text-accent">{t("backToSearch")}</Link>
  </div>;
}
