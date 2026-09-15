"use server";

import { retryTransaction } from "@/lib/db/retry";
import type { Prisma } from "@/generated/prisma/client";
import { dateOnlySchema, validStayRange } from "@/lib/booking/selection";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { isRangeAvailable } from "@/lib/booking/availability";
import { nightsInRange } from "@/lib/booking/nights";
import { BOOKING_HOLD_DURATION_MS } from "@/lib/booking/hold";
import { phoneSchema, emailSchema } from "@/lib/auth/login-flow";
import { requestOtp, verifyOtp, OtpRateLimitError } from "@/lib/auth/otp";
import { createGuestSession } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";

/**
 * Tunnel de réservation (CDC §6.2, épic 5) : trois étapes, chacune une
 * Server Action distincte pour rester utilisable avec `useActionState`
 * (voir src/components/auth/OtpLoginForm.tsx pour le même principe côté
 * connexion). La disponibilité est revérifiée à CHAQUE étape, jamais
 * seulement à la première — voir isRangeAvailable.
 */

class UnavailableError extends Error {}

function generateStayCode(): string {
  // Remis au voyageur à la confirmation du paiement (CDC §5.1.6, Sprint 6) ;
  // généré dès la demande car la colonne est non nullable, mais pas encore
  // affiché à ce stade — voir la page de confirmation.
  return randomBytes(4).toString("hex").toUpperCase();
}

const datesSchema = z.object({
  propertyId: z.string().min(1),
  checkIn: dateOnlySchema.transform(value => new Date(value)),
  checkOut: dateOnlySchema.transform(value => new Date(value)),
  guests: z.coerce.number().int().positive(),
});

export type DatesState = { status: "idle" | "ok" | "error"; message?: string };

async function checkPropertyAndRange(
  propertyId: string,
  checkIn: Date,
  checkOut: Date,
  guests: number,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string | null> {
  if (!validStayRange(checkIn, checkOut)) return "invalid_range";

  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { maxGuests: true, status: true, verification: { select: { status: true, expiresAt: true } } },
  });
  if (!property || property.status !== "PUBLISHED") return "unavailable";
  if (!property.verification || property.verification.status !== "ACTIVE" || property.verification.expiresAt <= new Date()) return "unavailable";
  if (guests > property.maxGuests) return "too_many_guests";
  if (!(await isRangeAvailable(propertyId, checkIn, checkOut, db))) return "unavailable";
  return null;
}

/** Étape 1 : sélection de dates avec disponibilité temps réel (épic 5.1). */
export async function checkAvailabilityAction(_prev: DatesState, formData: FormData): Promise<DatesState> {
  const parsed = datesSchema.safeParse({
    propertyId: formData.get("propertyId"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    guests: formData.get("guests"),
  });
  if (!parsed.success) return { status: "error", message: "invalid" };
  const { propertyId, checkIn, checkOut, guests } = parsed.data;

  const error = await checkPropertyAndRange(propertyId, checkIn, checkOut, guests);
  if (error) return { status: "error", message: error };

  return { status: "ok" };
}

const identitySchema = datesSchema.extend({
  phone: phoneSchema,
  fullName: z.string().trim().min(2),
  // Canal de secours optionnel pour le code (décision 0014) — jamais requis,
  // le téléphone reste le seul canal obligatoire (CDC §2, §6.2).
  email: emailSchema,
});

export type IdentityState = { status: "idle" | "sent" | "error"; message?: string };

/** Étape 2 : identification du voyageur par téléphone, avant l'envoi du code (épic 5.3). */
export async function requestGuestOtpAction(_prev: IdentityState, formData: FormData): Promise<IdentityState> {
  const parsed = identitySchema.safeParse({
    propertyId: formData.get("propertyId"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    guests: formData.get("guests"),
    phone: formData.get("phone"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { status: "error", message: "invalid" };
  const { propertyId, checkIn, checkOut, guests, phone: rawPhone } = parsed.data;
  const phone = rawPhone.replace(/\s+/g, "");

  const error = await checkPropertyAndRange(propertyId, checkIn, checkOut, guests);
  if (error) return { status: "error", message: error };

  try {
    // The phone authorizes access to previous bookings: send the proof only
    // to that phone, never to an email just entered in this form.
    await requestOtp({ phone, purpose: "GUEST_BOOKING" });
  } catch (err) {
    if (err instanceof OtpRateLimitError) return { status: "error", message: "rate_limited" };
    throw err;
  }

  return { status: "sent" };
}

const confirmSchema = identitySchema.extend({
  code: z.string().trim().length(6),
});

export type ConfirmState = { status: "idle" | "error"; message?: string };

/**
 * Étape 3 : vérification du code, pose du verrou de calendrier et création
 * de la demande (épics 5.2, 5.3). Tout se joue dans une seule transaction :
 * la disponibilité est revérifiée une dernière fois à l'intérieur, pour ne
 * jamais poser un verrou sur des dates qu'un autre voyageur vient de
 * réserver entre l'étape précédente et celle-ci.
 */
export async function confirmBookingAction(_prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  const parsed = confirmSchema.safeParse({
    propertyId: formData.get("propertyId"),
    checkIn: formData.get("checkIn"),
    checkOut: formData.get("checkOut"),
    guests: formData.get("guests"),
    phone: formData.get("phone"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { status: "error", message: "invalid" };
  const { propertyId, checkIn, checkOut, guests, phone: rawPhone, fullName, email, code } = parsed.data;
  const phone = rawPhone.replace(/\s+/g, "");

  const validationError = await checkPropertyAndRange(propertyId, checkIn, checkOut, guests);
  if (validationError) return { status: "error", message: validationError };

  const result = await verifyOtp({ phone, purpose: "GUEST_BOOKING", code });
  if (!result.ok) return { status: "error", message: result.reason };

  const nights = nightsInRange(checkIn, checkOut);
  const holdExpiresAt = new Date(Date.now() + BOOKING_HOLD_DURATION_MS);

  let bookingId: string;
  let guestSessionId: string;
  try {
    ({ bookingId, guestSessionId } = await retryTransaction(() => prisma.$transaction(async (tx) => {
      const error = await checkPropertyAndRange(propertyId, checkIn, checkOut, guests, tx);
      if (error) throw new UnavailableError(error);

      const guestSession = await tx.guestSession.create({
        data: { phone, email, fullName, expiresAt: holdExpiresAt },
      });

      const booking = await tx.booking.create({
        data: {
          propertyId,
          guestSessionId: guestSession.id,
          checkIn,
          checkOut,
          guests,
          stayCode: generateStayCode(),
          holdExpiresAt,
        },
      });

      await tx.availabilityDay.createMany({
        data: nights.map((date) => ({ propertyId, date, status: "HELD" as const, bookingId: booking.id })),
        skipDuplicates: true,
      });

      await tx.availabilityDay.updateMany({
        where: { propertyId, date: { in: nights }, status: "OPEN" },
        data: { status: "HELD", bookingId: booking.id },
      });
      const held = await tx.availabilityDay.count({ where: { bookingId: booking.id, status: "HELD" } });
      if (held !== nights.length) throw new UnavailableError("unavailable");

      await tx.auditLog.create({
        data: {
          action: "booking.requested",
          entity: "Booking",
          entityId: booking.id,
          bookingId: booking.id,
          metadata: { propertyId, checkIn: checkIn.toISOString(), checkOut: checkOut.toISOString(), guests },
        },
      });

      return { bookingId: booking.id, guestSessionId: guestSession.id };
    }, { isolationLevel: "Serializable" })));
  } catch (err) {
    if (err instanceof UnavailableError) return { status: "error", message: err.message };
    if (err && typeof err === "object" && "code" in err && ["P2002", "P2034"].includes(String(err.code))) {
      return { status: "error", message: "unavailable" };
    }
    throw err;
  }

  await createGuestSession(guestSessionId);
  return redirect({
    href: `/reserver/confirmation/${bookingId}`,
    locale: (formData.get("locale") as string) || "fr",
  });
}
