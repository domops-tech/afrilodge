import { fieldDb, listDraftFiles, updateDraftVisit, type DraftFile } from "@/lib/field/db";

/**
 * Moteur de synchronisation différée (CDC §6.4.4). Déclenché explicitement
 * par l'agent ou automatiquement au retour du réseau (voir l'écouteur
 * `online` dans VisitWorkflow) — pas l'API Background Sync du navigateur :
 * son support est inégal (absente de Safari/iOS) et son déclenchement, du
 * seul ressort du navigateur, la rendrait impossible à garantir dans les
 * 45 minutes du critère CDC §11.1. Un déclenchement applicatif explicite
 * est plus fiable et plus simple à tester (voir docs/agile/decisions/0005).
 */

async function uploadFile(visitId: string, file: DraftFile): Promise<void> {
  const urlResponse = await fetch("/api/terrain/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitId,
      kind: file.kind === "visit-photo" ? "visit-photo" : "identity-document",
      contentType: file.blob.type || "image/webp",
    }),
  });
  if (!urlResponse.ok) throw new Error(`upload_url_failed:${urlResponse.status}`);
  const { uploadUrl, storageKey } = (await urlResponse.json()) as {
    uploadUrl: string;
    storageKey: string;
  };

  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.blob.type || "image/webp" },
    body: file.blob,
  });
  if (!putResponse.ok) throw new Error(`upload_put_failed:${putResponse.status}`);

  await fieldDb.files.update(file.id!, { uploaded: true, storageKey });
}

export async function syncDraftVisit(visitId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await updateDraftVisit(visitId, { status: "syncing", syncError: undefined });

  try {
    const files = await listDraftFiles(visitId);
    const pending = files.filter((f) => !f.uploaded);
    for (const file of pending) {
      await uploadFile(visitId, file);
    }

    const uploaded = await listDraftFiles(visitId);
    const draft = await fieldDb.visits.get(visitId);
    if (!draft) throw new Error("draft_not_found");

    const response = await fetch(`/api/terrain/visits/${visitId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startedAt: draft.startedAt,
        checkInLatitude: draft.checkInLatitude,
        checkInLongitude: draft.checkInLongitude,
        accessLandmarks: draft.accessLandmarks,
        amenityChecklist: draft.amenityChecklist,
        identityVerifiedByAgent: draft.identityVerifiedByAgent,
        photos: uploaded
          .filter((f) => f.kind === "visit-photo" && f.storageKey)
          .map((f) => ({
            slot: f.slot,
            label: f.label,
            storageKey: f.storageKey,
            takenAt: f.takenAt,
            latitude: f.latitude,
            longitude: f.longitude,
          })),
        identityDocument: uploaded.find((f) => f.kind === "identity-document" && f.storageKey)
          ?.storageKey,
        titleToRentDocument: uploaded.find((f) => f.kind === "title-to-rent" && f.storageKey)
          ?.storageKey,
      }),
    });

    if (!response.ok) throw new Error(`sync_failed:${response.status}`);

    await updateDraftVisit(visitId, { status: "synced", syncedAt: new Date().toISOString() });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    await updateDraftVisit(visitId, { status: "ready_to_sync", syncError: message });
    return { ok: false, error: message };
  }
}
