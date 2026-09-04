"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { compressImageFile } from "@/lib/images/compress";
import { getCurrentPosition } from "@/lib/field/geolocation";
import { syncDraftVisit } from "@/lib/field/sync";
import {
  addDraftFile,
  getOrCreateDraftVisit,
  listDraftFiles,
  removeDraftFile,
  updateDraftVisit,
  type AmenityChecklistEntry,
  type DraftFile,
  type DraftVisit,
} from "@/lib/field/db";
import type { PhotoSlot } from "@/generated/prisma/enums";

// Liste imposée de prises de vue (CDC §4.1.4). PIECE est répétable — une
// visite a plusieurs pièces — les six autres sont capturées une seule fois.
const FIXED_SLOTS: PhotoSlot[] = ["FACADE", "ENTREE", "SANITAIRES", "CUISINE", "VUE", "ACCES"];

type Step = "intro" | "photos" | "amenities" | "landmarks" | "identity" | "review";

function Thumb({ blob, className }: { blob: Blob; className?: string }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  // eslint-disable-next-line @next/next/no-img-element -- blob local, next/image ne sait pas servir un object URL
  return <img src={url} alt="" className={className} />;
}

export function VisitWorkflow({
  visitId,
  propertyTitle,
  announcedAmenities,
  alreadyCompleted,
}: {
  visitId: string;
  propertyTitle: string;
  announcedAmenities: string[];
  alreadyCompleted: boolean;
}) {
  const t = useTranslations("field");
  const [draft, setDraft] = useState<DraftVisit | null>(null);
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [step, setStep] = useState<Step>("intro");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const fixedInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSlotRef = useRef<PhotoSlot | null>(null);
  const roomInputRef = useRef<HTMLInputElement | null>(null);
  const [roomLabel, setRoomLabel] = useState("");
  const identityInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const refreshFiles = useCallback(async () => {
    setFiles(await listDraftFiles(visitId));
  }, [visitId]);

  useEffect(() => {
    (async () => {
      const d = await getOrCreateDraftVisit(visitId, propertyTitle);
      if (d.amenityChecklist.length === 0 && announcedAmenities.length > 0) {
        d.amenityChecklist = announcedAmenities.map((amenityName) => ({
          amenityName,
          announced: true,
          observed: true,
        }));
        await updateDraftVisit(visitId, { amenityChecklist: d.amenityChecklist });
      }
      setDraft(d);
      if (d.status !== "not_started") setStep("photos");
      await refreshFiles();
    })();
  }, [visitId, propertyTitle, announcedAmenities, refreshFiles]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      if (draft?.status === "ready_to_sync") void handleSync();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleSync défini plus bas, capturé via closure au moment de l'événement
  }, [draft?.status]);

  const patchDraft = useCallback(
    async (patch: Partial<DraftVisit>) => {
      await updateDraftVisit(visitId, patch);
      setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    },
    [visitId]
  );

  async function handleStart() {
    setGeoError(null);
    let latitude: number | undefined;
    let longitude: number | undefined;
    try {
      const position = await getCurrentPosition();
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
    } catch {
      setGeoError(t("geolocationError"));
    }
    await patchDraft({
      status: "in_progress",
      startedAt: new Date().toISOString(),
      checkInLatitude: latitude,
      checkInLongitude: longitude,
    });
    setStep("photos");
  }

  async function captureFile(file: File, slot: PhotoSlot, label?: string) {
    const compressed = await compressImageFile(file);
    await addDraftFile({
      visitId,
      kind: "visit-photo",
      slot,
      label,
      blob: compressed,
      takenAt: new Date().toISOString(),
      latitude: draft?.checkInLatitude,
      longitude: draft?.checkInLongitude,
    });
    await refreshFiles();
  }

  async function captureIdentityFile(file: File, kind: "identity-document" | "title-to-rent") {
    const compressed = await compressImageFile(file);
    // Une seule pièce par type : on retire l'ancienne si l'agent reprend la photo.
    const existing = files.find((f) => f.kind === kind);
    if (existing?.id) await removeDraftFile(existing.id);
    await addDraftFile({
      visitId,
      kind,
      blob: compressed,
      takenAt: new Date().toISOString(),
    });
    await refreshFiles();
  }

  function updateAmenity(index: number, patch: Partial<AmenityChecklistEntry>) {
    if (!draft) return;
    const next = draft.amenityChecklist.map((a, i) => (i === index ? { ...a, ...patch } : a));
    void patchDraft({ amenityChecklist: next });
  }

  async function handleSync() {
    await patchDraft({ status: "syncing" });
    const result = await syncDraftVisit(visitId);
    const fresh = await getOrCreateDraftVisit(visitId, propertyTitle);
    setDraft(fresh);
    return result;
  }

  const roomPhotos = useMemo(() => files.filter((f) => f.kind === "visit-photo" && f.slot === "PIECE"), [files]);
  const fixedPhotoBySlot = useMemo(() => {
    const map = new Map<PhotoSlot, DraftFile>();
    for (const f of files) {
      if (f.kind === "visit-photo" && f.slot && f.slot !== "PIECE") map.set(f.slot, f);
    }
    return map;
  }, [files]);
  const identityDoc = files.find((f) => f.kind === "identity-document");
  const titleDoc = files.find((f) => f.kind === "title-to-rent");

  const photosComplete = FIXED_SLOTS.every((s) => fixedPhotoBySlot.has(s)) && roomPhotos.length > 0;

  if (alreadyCompleted) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p>{t("alreadyCompleted")}</p>
        <Link href="/terrain" className="text-sm font-medium text-accent">
          {t("backToList")}
        </Link>
      </div>
    );
  }

  if (!draft) return null;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <Link href="/terrain" className="text-xs text-muted">
            ← {t("backToList")}
          </Link>
          <h1 className="text-lg font-semibold">{propertyTitle}</h1>
        </div>
        {!isOnline ? (
          <span
            data-testid="offline-badge"
            className="rounded-full bg-danger/15 px-2.5 py-1 text-xs font-medium text-danger"
          >
            {t("offlineBadge")}
          </span>
        ) : null}
      </header>

      {step === "intro" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          {geoError ? <p className="text-sm text-danger">{geoError}</p> : null}
          <Button data-testid="start-visit" onClick={handleStart}>
            {t("start")}
          </Button>
        </div>
      ) : null}

      {step === "photos" ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-medium">{t("stepPhotos")}</h2>

          <input
            ref={fixedInputRef}
            data-testid="photo-input-fixed"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              const slot = pendingSlotRef.current;
              e.target.value = "";
              if (file && slot) await captureFile(file, slot);
            }}
          />

          <div className="flex flex-col gap-2">
            {FIXED_SLOTS.map((slot) => {
              const photo = fixedPhotoBySlot.get(slot);
              return (
                <div key={slot} className="flex items-center justify-between gap-3 rounded-[var(--radius-default)] border border-border p-3">
                  <div className="flex items-center gap-3">
                    {photo ? <Thumb blob={photo.blob} className="h-12 w-12 rounded object-cover" /> : null}
                    <span className="text-sm font-medium">{t(`slot.${slot}`)}</span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    data-testid={`capture-${slot}`}
                    onClick={() => {
                      pendingSlotRef.current = slot;
                      fixedInputRef.current?.click();
                    }}
                  >
                    {photo ? t("retakePhoto") : t("takePhoto")}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("slot.PIECE")}</span>
            {roomPhotos.map((photo) => (
              <div key={photo.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-default)] border border-border p-3">
                <div className="flex items-center gap-3">
                  <Thumb blob={photo.blob} className="h-12 w-12 rounded object-cover" />
                  <span className="text-sm">{photo.label}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    if (photo.id) await removeDraftFile(photo.id);
                    await refreshFiles();
                  }}
                >
                  {t("removePhoto")}
                </Button>
              </div>
            ))}
            <div className="flex items-end gap-2">
              <Field
                id="roomLabel"
                label={t("roomLabelLabel")}
                placeholder={t("roomLabelPlaceholder")}
                value={roomLabel}
                onChange={(e) => setRoomLabel(e.target.value)}
              />
              <input
                ref={roomInputRef}
                data-testid="photo-input-room"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) {
                    await captureFile(file, "PIECE", roomLabel || t("slot.PIECE"));
                    setRoomLabel("");
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                data-testid="add-room-photo"
                onClick={() => roomInputRef.current?.click()}
              >
                {t("addRoomPhoto")}
              </Button>
            </div>
          </div>

          <Button disabled={!photosComplete} data-testid="photos-continue" onClick={() => setStep("amenities")}>
            {t("continue")}
          </Button>
        </section>
      ) : null}

      {step === "amenities" ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-medium">{t("stepAmenities")}</h2>
          <div className="flex flex-col gap-2">
            {draft.amenityChecklist.map((a, i) => (
              <label key={a.amenityName} className="flex items-center justify-between gap-3 rounded-[var(--radius-default)] border border-border p-3">
                <span className="text-sm">{a.amenityName}</span>
                <input
                  type="checkbox"
                  checked={a.observed}
                  onChange={(e) => updateAmenity(i, { observed: e.target.checked })}
                  className="h-5 w-5"
                />
              </label>
            ))}
          </div>
          <Button data-testid="amenities-continue" onClick={() => setStep("landmarks")}>
            {t("continue")}
          </Button>
        </section>
      ) : null}

      {step === "landmarks" ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-medium">{t("stepLandmarks")}</h2>
          <textarea
            data-testid="landmarks-input"
            className="min-h-32 rounded-[var(--radius-default)] border border-border bg-background p-3 text-base"
            placeholder={t("landmarksPlaceholder")}
            defaultValue={draft.accessLandmarks}
            onBlur={(e) => void patchDraft({ accessLandmarks: e.target.value })}
          />
          <Button data-testid="landmarks-continue" onClick={() => setStep("identity")}>
            {t("continue")}
          </Button>
        </section>
      ) : null}

      {step === "identity" ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-medium">{t("stepIdentity")}</h2>

          <input
            ref={identityInputRef}
            data-testid="photo-input-identity"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) await captureIdentityFile(file, "identity-document");
            }}
          />
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-default)] border border-border p-3">
            <div className="flex items-center gap-3">
              {identityDoc ? <Thumb blob={identityDoc.blob} className="h-12 w-12 rounded object-cover" /> : null}
              <span className="text-sm font-medium">{t("identityDocumentLabel")}</span>
            </div>
            <Button
              type="button"
              variant="secondary"
              data-testid="capture-identity"
              onClick={() => identityInputRef.current?.click()}
            >
              {identityDoc ? t("retakePhoto") : t("takePhoto")}
            </Button>
          </div>

          <input
            ref={titleInputRef}
            data-testid="photo-input-title"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) await captureIdentityFile(file, "title-to-rent");
            }}
          />
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-default)] border border-border p-3">
            <div className="flex items-center gap-3">
              {titleDoc ? <Thumb blob={titleDoc.blob} className="h-12 w-12 rounded object-cover" /> : null}
              <span className="text-sm font-medium">{t("titleToRentLabel")}</span>
            </div>
            <Button
              type="button"
              variant="secondary"
              data-testid="capture-title"
              onClick={() => titleInputRef.current?.click()}
            >
              {titleDoc ? t("retakePhoto") : t("takePhoto")}
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              data-testid="identity-verified-checkbox"
              className="h-5 w-5"
              checked={draft.identityVerifiedByAgent}
              onChange={(e) => void patchDraft({ identityVerifiedByAgent: e.target.checked })}
            />
            {t("identityVerifiedLabel")}
          </label>

          <Button
            disabled={!identityDoc || !titleDoc || !draft.identityVerifiedByAgent}
            data-testid="identity-continue"
            onClick={() => setStep("review")}
          >
            {t("continue")}
          </Button>
        </section>
      ) : null}

      {step === "review" ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-medium">{t("stepReview")}</h2>
          <p className="text-sm text-muted">
            {t("reviewPhotosCount", { count: FIXED_SLOTS.length + roomPhotos.length })}
            {" · "}
            {t("reviewAmenitiesCount", { count: draft.amenityChecklist.filter((a) => a.observed).length })}
          </p>

          {draft.status === "synced" ? (
            <p data-testid="sync-success-message" className="text-sm font-medium text-verified">
              {t("syncSuccess")}
            </p>
          ) : (
            <>
              {draft.status === "syncing" ? <p className="text-sm text-muted">{t("syncing")}</p> : null}
              {draft.syncError ? <p className="text-sm text-danger">{t("syncErrorMsg")}</p> : null}
              {!isOnline ? (
                <p data-testid="pending-sync-message" className="text-sm text-muted">
                  {t("pendingSync")}
                </p>
              ) : null}
              <Button
                disabled={draft.status === "syncing"}
                data-testid="complete-visit"
                onClick={async () => {
                  await patchDraft({ status: "ready_to_sync" });
                  if (navigator.onLine) await handleSync();
                }}
              >
                {navigator.onLine ? t("completeVisit") : t("syncNow")}
              </Button>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
