import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { prisma } from "@/lib/db/client";
import { mergeRoomLabels } from "@/lib/property/room-labels";
import { VisitWorkflow } from "./VisitWorkflow";

// Parcours de visite guidé (CDC §4.1) : chargé une fois en ligne, puis
// entièrement piloté côté client (IndexedDB) jusqu'à la synchronisation —
// voir docs/agile/decisions/0005 pour le choix assumé de ne pas installer
// de service worker de précache en Sprint 1.
export default async function VisitPage({
  params,
}: PageProps<"/[locale]/terrain/visite/[visitId]">) {
  const { locale, visitId } = await params;
  setRequestLocale(locale);
  const session = await requireRole("AGENT");

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      verificationRequest: {
        include: { property: { include: { amenities: true } } },
      },
    },
  });

  if (!visit || visit.agentId !== session.userId) {
    notFound();
  }

  // Noms de pièces déjà saisis par les agents, du plus utilisé au moins utilisé : proposés pour éviter les doublons.
  const usedRooms = await prisma.visitPhoto.groupBy({
    by: ["label"],
    where: { slot: "PIECE", label: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { label: "desc" } },
    take: 40,
  });
  const roomSuggestions = mergeRoomLabels(usedRooms.map((room) => room.label ?? ""));

  return (
    <VisitWorkflow
      visitId={visit.id}
      propertyTitle={visit.verificationRequest.property.title}
      announcedAmenities={visit.verificationRequest.property.amenities.map((a) => a.name)}
      roomSuggestions={roomSuggestions}
      alreadyCompleted={Boolean(visit.completedAt)}
    />
  );
}
