import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/db/client";

const photoSchema = z.object({
  slot: z.enum(["FACADE", "ENTREE", "PIECE", "SANITAIRES", "CUISINE", "VUE", "ACCES"]),
  label: z.string().optional(),
  storageKey: z.string().min(1),
  takenAt: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const bodySchema = z.object({
  startedAt: z.string().optional(),
  checkInLatitude: z.number().optional(),
  checkInLongitude: z.number().optional(),
  accessLandmarks: z.string().optional(),
  amenityChecklist: z.array(
    z.object({
      amenityName: z.string(),
      announced: z.boolean(),
      observed: z.boolean(),
      note: z.string().optional(),
    })
  ),
  identityVerifiedByAgent: z.boolean(),
  photos: z.array(photoSchema),
  identityDocument: z.string().optional(),
  titleToRentDocument: z.string().optional(),
});

/**
 * Point d'arrivée de la synchronisation différée (CDC §4.1, §6.4.4) : crée
 * en une transaction tout ce que l'agent a saisi hors connexion, puis fait
 * passer la demande de vérification à VISITÉE. La validation/refus de la
 * fiche et l'attribution de la mention restent au back-office (Sprint 2).
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/terrain/visits/[visitId]/sync">) {
  const { session, error } = await requireApiRole("AGENT");
  if (error) return error;

  const { visitId } = await ctx.params;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { verificationRequest: true },
  });
  if (!visit || visit.agentId !== session.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (visit.completedAt) {
    return NextResponse.json({ error: "already_synced" }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.visit.update({
      where: { id: visitId },
      data: {
        startedAt: body.startedAt ? new Date(body.startedAt) : undefined,
        checkInAt: body.startedAt ? new Date(body.startedAt) : undefined,
        checkInLatitude: body.checkInLatitude,
        checkInLongitude: body.checkInLongitude,
        accessLandmarks: body.accessLandmarks,
        completedAt: new Date(),
      },
    });

    if (body.photos.length > 0) {
      await tx.visitPhoto.createMany({
        data: body.photos.map((p) => ({
          visitId,
          slot: p.slot,
          label: p.label,
          storageKey: p.storageKey,
          takenAt: new Date(p.takenAt),
          latitude: p.latitude,
          longitude: p.longitude,
        })),
      });
    }

    if (body.amenityChecklist.length > 0) {
      await tx.amenityCheck.createMany({
        data: body.amenityChecklist.map((a) => ({
          visitId,
          amenityName: a.amenityName,
          announced: a.announced,
          observed: a.observed,
          note: a.note,
        })),
      });
    }

    if (body.identityDocument && body.titleToRentDocument) {
      await tx.identityCheck.create({
        data: {
          visitId,
          identityDocumentRef: body.identityDocument,
          titleToRentRef: body.titleToRentDocument,
          verifiedByAgent: body.identityVerifiedByAgent,
        },
      });
    }

    if (body.accessLandmarks) {
      await tx.property.update({
        where: { id: visit.verificationRequest.propertyId },
        data: { accessLandmarks: body.accessLandmarks },
      });
    }

    await tx.verificationRequest.update({
      where: { id: visit.verificationRequestId },
      data: { status: "VISITED" },
    });

    await tx.auditLog.create({
      data: {
        action: "visit.synced",
        entity: "Visit",
        entityId: visitId,
        actorId: session.userId,
        metadata: { photoCount: body.photos.length },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
