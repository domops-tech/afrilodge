"use server";

import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/guard";
import { redirect } from "@/i18n/navigation";
import { AMENITY_OPTIONS } from "@/lib/property/amenities";

const schema = z.object({
  title: z.string().trim().min(3),
  description: z.string().trim().min(10),
  neighborhood: z.string().trim().min(2),
  city: z.string().trim().min(2),
  pricePerNight: z.coerce.number().int().positive(),
  maxGuests: z.coerce.number().int().positive(),
});

/** Création d'un bien par le propriétaire — préalable à toute demande de vérification (CDC §5.2.16). */
export async function createPropertyAction(formData: FormData): Promise<void> {
  const session = await requireRole("OWNER");
  const locale = (formData.get("locale") as string) || "fr";

  const parsed = schema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    neighborhood: formData.get("neighborhood"),
    city: formData.get("city"),
    pricePerNight: formData.get("pricePerNight"),
    maxGuests: formData.get("maxGuests"),
  });
  if (!parsed.success) {
    return redirect({ href: "/proprietaire/nouveau?erreur=invalide", locale });
  }

  const selectedAmenities = AMENITY_OPTIONS.filter((name) => formData.get(`amenity_${name}`) === "on");

  const property = await prisma.property.create({
    data: {
      ...parsed.data,
      ownerId: session.userId,
      status: "DRAFT",
      amenities: { create: selectedAmenities.map((name) => ({ name, confirmed: null })) },
    },
  });

  return redirect({ href: `/proprietaire/biens/${property.id}`, locale });
}
