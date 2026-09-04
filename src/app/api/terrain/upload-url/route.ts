import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/api-guard";
import { prisma } from "@/lib/db/client";
import { buildStorageKey, createUploadUrl } from "@/lib/storage/client";

const bodySchema = z.object({
  visitId: z.string().min(1),
  kind: z.enum(["visit-photo", "identity-document"]),
  contentType: z.string().min(1),
});

/**
 * Émet une URL signée pour un envoi direct du navigateur vers le stockage
 * objet (CDC §7.1) — appelée par src/lib/field/sync.ts au retour du réseau,
 * jamais pendant la capture elle-même (hors connexion à ce moment-là).
 */
export async function POST(request: NextRequest) {
  const { session, error } = await requireApiRole("AGENT");
  if (error) return error;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { visitId, kind, contentType } = parsed.data;

  const visit = await prisma.visit.findUnique({ where: { id: visitId }, select: { agentId: true } });
  if (!visit || visit.agentId !== session.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const extension = contentType.split("/")[1]?.split("+")[0] || "webp";
  const storageKey = buildStorageKey(kind, visitId, extension);
  const uploadUrl = await createUploadUrl(storageKey, contentType);

  return NextResponse.json({ uploadUrl, storageKey });
}
