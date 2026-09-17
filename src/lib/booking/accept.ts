import { prisma } from "@/lib/db/client";
import { transitionBooking } from "@/lib/booking/state-machine";
import { getPaymentProvider } from "@/lib/payments/simulated";

/** L'appel PSP est rejouable avec bookingId. Le statut et le paiement sont
 * ensuite enregistrés ensemble ; un échec laisse la demande réessayable. */
export async function acceptBooking(params: { bookingId: string; propertyId: string; ownerId: string }) {
  const { bookingId, propertyId, ownerId } = params;
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId }, include: { property: true, guestSession: true, payment: true },
  });
  function check(current: typeof booking) {
    if (current.propertyId !== propertyId || current.property.ownerId !== ownerId ||
        !["REQUESTED", "ACCEPTED"].includes(current.status) ||
        (current.holdExpiresAt && current.holdExpiresAt <= new Date())) {
      throw new Error("Réservation non éligible à l’acceptation.");
    }
  }
  check(booking);
  if (booking.status === "ACCEPTED" && booking.payment) return;

  const provider = getPaymentProvider();
  const { providerIntentRef } = await provider.createIntent({
    bookingId, amount: booking.totalAmount, payerPhone: booking.guestSession.phone,
  });
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`;
    const current = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId }, include: { property: true, guestSession: true, payment: true },
    });
    check(current);
    if (current.status === "ACCEPTED" && current.payment) return;
    if (current.status === "REQUESTED") {
      await transitionBooking({ bookingId, to: "ACCEPTED", actorId: ownerId }, tx);
    }
    await tx.payment.create({ data: {
      bookingId, status: "INTENT_CREATED", providerName: provider.name,
      providerIntentRef, amount: current.totalAmount,
    } });
  });
}
