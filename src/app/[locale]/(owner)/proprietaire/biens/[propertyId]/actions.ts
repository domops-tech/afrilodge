"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/guard";
import { redirect } from "@/i18n/navigation";
import { AMENITY_OPTIONS } from "@/lib/property/amenities";
import { transitionBooking } from "@/lib/booking/state-machine";
import { startOfUtcDay, addUtcDays } from "@/lib/booking/nights";

/**
 * Actions de l'espace de gestion d'un bien (CDC §6.3). Formulaires
 * classiques (pas `useActionState`) : fonctionnent sans JavaScript, comme
 * la recherche publique (Sprint 3). Les échecs métier (demande déjà en
 * cours, équipements verrouillés…) redirigent avec `?erreur=code`, que la
 * page lit pour afficher un message — pas de composant client requis.
 *
 * Chaque action revérifie `ownerId` : le garde de rôle seul ne suffit pas,
 * un propriétaire ne doit pas pouvoir agir sur le bien d'un autre (voir
 * src/lib/auth/guard.ts).
 */

async function loadOwnedPropertyOrThrow(propertyId: string, ownerId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { verificationRequests: { include: { visit: true } } },
  });
  if (!property || property.ownerId !== ownerId) {
    throw new Error("Bien introuvable pour ce compte.");
  }
  return property;
}

function backTo(propertyId: string, formData: FormData, error?: string) {
  const locale = (formData.get("locale") as string) || "fr";
  const href = error ? `/proprietaire/biens/${propertyId}?erreur=${error}` : `/proprietaire/biens/${propertyId}`;
  return redirect({ href, locale });
}

const updateSchema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().min(10),
  pricePerNight: z.coerce.number().int().positive(),
  maxGuests: z.coerce.number().int().positive(),
});

/** Prix, description, titre, capacité — toujours modifiables (CDC §6.3.2). */
export async function updatePropertyAction(formData: FormData): Promise<void> {
  const session = await requireRole("OWNER");
  const propertyId = String(formData.get("propertyId"));
  await loadOwnedPropertyOrThrow(propertyId, session.userId);

  const parsed = updateSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    pricePerNight: formData.get("pricePerNight"),
    maxGuests: formData.get("maxGuests"),
  });
  if (!parsed.success) {
    return backTo(propertyId, formData, "invalide");
  }

  await prisma.property.update({ where: { id: propertyId }, data: parsed.data });
  return backTo(propertyId, formData);
}

/** Sollicite une vérification (CDC §5.2.16, §4.1.1) — uniquement si aucune demande n'est déjà en cours. */
export async function requestVerificationAction(formData: FormData): Promise<void> {
  const session = await requireRole("OWNER");
  const propertyId = String(formData.get("propertyId"));
  const property = await loadOwnedPropertyOrThrow(propertyId, session.userId);

  const hasOngoingRequest = property.verificationRequests.some((r) =>
    ["REQUESTED", "SCHEDULED", "VISITED", "APPROVED"].includes(r.status)
  );
  if (hasOngoingRequest) {
    return backTo(propertyId, formData, "demande-en-cours");
  }

  await prisma.$transaction([
    prisma.verificationRequest.create({
      data: { propertyId, ownerId: session.userId, status: "REQUESTED", packPaid: false },
    }),
    prisma.property.update({ where: { id: propertyId }, data: { status: "PENDING_VERIFICATION" } }),
  ]);

  return backTo(propertyId, formData);
}

/** Équipements annoncés — modifiables tant qu'aucune visite n'a démarré (voir prisma/schema.prisma, PropertyAmenity). */
export async function updateAmenitiesAction(formData: FormData): Promise<void> {
  const session = await requireRole("OWNER");
  const propertyId = String(formData.get("propertyId"));
  const property = await loadOwnedPropertyOrThrow(propertyId, session.userId);

  const alreadyVisited = property.verificationRequests.some((r) => r.visit);
  if (alreadyVisited) {
    return backTo(propertyId, formData, "verrouille");
  }

  const selected = AMENITY_OPTIONS.filter((name) => formData.get(`amenity_${name}`) === "on");

  await prisma.$transaction([
    prisma.propertyAmenity.deleteMany({ where: { propertyId } }),
    prisma.propertyAmenity.createMany({
      data: selected.map((name) => ({ propertyId, name, confirmed: null })),
    }),
  ]);

  return backTo(propertyId, formData);
}

const WINDOW_DAYS = 60;

/** Calendrier de disponibilité (CDC §6.3.3) — bascule OPEN/BLOCKED, ne touche jamais HELD/BOOKED (piloté par la réservation, épic 5). */
export async function updateAvailabilityAction(formData: FormData): Promise<void> {
  const session = await requireRole("OWNER");
  const propertyId = String(formData.get("propertyId"));
  await loadOwnedPropertyOrThrow(propertyId, session.userId);

  const blockedDates = new Set(formData.getAll("blockedDate").map(String));

  // UTC, jamais l'heure locale : les clés doivent correspondre à celles
  // envoyées par le formulaire (voir page.tsx et src/lib/booking/nights.ts).
  const today = startOfUtcDay();
  const window: Date[] = Array.from({ length: WINDOW_DAYS }, (_, i) => addUtcDays(today, i));

  const existing = await prisma.availabilityDay.findMany({
    where: { propertyId, date: { gte: today, lt: window[window.length - 1] } },
  });
  const existingByDate = new Map(existing.map((row) => [row.date.toISOString().slice(0, 10), row]));

  await prisma.$transaction(async (tx) => {
    for (const date of window) {
      const key = date.toISOString().slice(0, 10);
      const current = existingByDate.get(key);
      const wantsBlocked = blockedDates.has(key);

      // Piloté par une réservation en cours (épic 5) — le propriétaire ne
      // peut jamais l'écraser depuis ce calendrier.
      if (current && (current.status === "HELD" || current.status === "BOOKED")) continue;

      if (wantsBlocked) {
        await tx.availabilityDay.upsert({
          where: { propertyId_date: { propertyId, date } },
          update: { status: "BLOCKED" },
          create: { propertyId, date, status: "BLOCKED" },
        });
      } else if (current) {
        // Absence de ligne = OPEN (convention établie au Sprint 3).
        await tx.availabilityDay.delete({ where: { id: current.id } });
      }
    }
  });

  return backTo(propertyId, formData);
}

/** `redirect()` interrompt le rendu par une exception : cette fonction ne retourne donc jamais quand elle redirige. */
async function loadOwnedBooking(propertyId: string, bookingId: string, formData: FormData) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.propertyId !== propertyId) {
    return backTo(propertyId, formData, "reservation-introuvable");
  }
  return booking;
}

/** Acceptation d'une demande (CDC §5.2.19, épic 5.4) — le calendrier reste HELD jusqu'au paiement (Sprint 6). */
export async function acceptBookingAction(formData: FormData): Promise<void> {
  const session = await requireRole("OWNER");
  const propertyId = String(formData.get("propertyId"));
  const bookingId = String(formData.get("bookingId"));
  await loadOwnedPropertyOrThrow(propertyId, session.userId);
  await loadOwnedBooking(propertyId, bookingId, formData);

  try {
    await transitionBooking({ bookingId, to: "ACCEPTED", actorId: session.userId });
  } catch {
    return backTo(propertyId, formData, "transition-refusee");
  }

  return backTo(propertyId, formData);
}

/** Refus d'une demande (CDC §5.2.19, épic 5.4) — libère immédiatement le calendrier, sans attendre l'expiration du verrou. */
export async function refuseBookingAction(formData: FormData): Promise<void> {
  const session = await requireRole("OWNER");
  const propertyId = String(formData.get("propertyId"));
  const bookingId = String(formData.get("bookingId"));
  await loadOwnedPropertyOrThrow(propertyId, session.userId);
  const booking = await loadOwnedBooking(propertyId, bookingId, formData);

  try {
    await transitionBooking({
      bookingId,
      to: "CANCELLED",
      actorId: session.userId,
      metadata: { reason: "owner_refused" },
    });
  } catch {
    return backTo(propertyId, formData, "transition-refusee");
  }

  await prisma.availabilityDay.deleteMany({
    where: {
      propertyId: booking.propertyId,
      date: { gte: booking.checkIn, lt: booking.checkOut },
      status: "HELD",
    },
  });

  return backTo(propertyId, formData);
}
