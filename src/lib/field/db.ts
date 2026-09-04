import Dexie, { type EntityTable } from "dexie";
import type { PhotoSlot } from "@/generated/prisma/enums";

/**
 * Stockage local de la visite en cours (CDC §6.4.4 — "fonctionnement hors
 * connexion, avec synchronisation différée"). IndexedDB via Dexie : les
 * photos et le formulaire de visite survivent à une perte de réseau, à un
 * rechargement de page, voire à la fermeture de l'onglet, jusqu'à ce que
 * `src/lib/field/sync.ts` les envoie au serveur.
 *
 * Périmètre assumé pour le Sprint 1 (voir docs/agile/decisions/0005) :
 * la page de visite elle-même doit être chargée une première fois en ligne
 * (l'agent ouvre la visite avant d'entrer dans une zone sans réseau) ; à
 * partir de là, plus aucun appel réseau n'est nécessaire jusqu'à la
 * synchronisation finale. Ce n'est pas une PWA installable avec worker de
 * précache — cette étape reste à faire si le besoin d'ouvrir l'app à froid
 * sans réseau se confirme.
 */

export type AmenityChecklistEntry = {
  amenityName: string;
  announced: boolean;
  observed: boolean;
  note?: string;
};

export type DraftVisitStatus = "not_started" | "in_progress" | "ready_to_sync" | "syncing" | "synced";

export interface DraftVisit {
  visitId: string; // id serveur du Visit (créé au Sprint 0/planifié par l'admin)
  propertyTitle: string;
  status: DraftVisitStatus;
  startedAt?: string; // ISO — horodatage CDC §4.1.3
  checkInLatitude?: number;
  checkInLongitude?: number;
  accessLandmarks?: string;
  amenityChecklist: AmenityChecklistEntry[];
  identityVerifiedByAgent: boolean;
  syncedAt?: string;
  syncError?: string;
}

export type DraftFileKind = "visit-photo" | "identity-document" | "title-to-rent";

export interface DraftFile {
  id?: number; // clé auto-incrémentée locale
  visitId: string;
  kind: DraftFileKind;
  slot?: PhotoSlot; // uniquement pour kind === "visit-photo"
  label?: string; // ex. "Salon" — répétable pour slot PIECE
  blob: Blob;
  takenAt: string; // ISO
  latitude?: number;
  longitude?: number;
  uploaded: boolean;
  storageKey?: string;
}

class FieldDatabase extends Dexie {
  visits!: EntityTable<DraftVisit, "visitId">;
  files!: EntityTable<DraftFile, "id">;

  constructor() {
    super("sejours-terrain");
    this.version(1).stores({
      visits: "visitId, status",
      files: "++id, visitId, kind, uploaded",
    });
  }
}

export const fieldDb = new FieldDatabase();

export async function getOrCreateDraftVisit(
  visitId: string,
  propertyTitle: string
): Promise<DraftVisit> {
  const existing = await fieldDb.visits.get(visitId);
  if (existing) return existing;

  const draft: DraftVisit = {
    visitId,
    propertyTitle,
    status: "not_started",
    amenityChecklist: [],
    identityVerifiedByAgent: false,
  };
  await fieldDb.visits.put(draft);
  return draft;
}

export async function updateDraftVisit(visitId: string, patch: Partial<DraftVisit>): Promise<void> {
  await fieldDb.visits.update(visitId, patch);
}

export async function addDraftFile(file: Omit<DraftFile, "id" | "uploaded">): Promise<number> {
  // Dexie type le retour de .add() d'après le type de la clé (`id?: number`),
  // donc `number | undefined` côté TS — en pratique .add() renvoie toujours
  // la clé générée.
  const id = await fieldDb.files.add({ ...file, uploaded: false });
  return id as number;
}

export async function listDraftFiles(visitId: string): Promise<DraftFile[]> {
  return fieldDb.files.where({ visitId }).toArray();
}

export async function removeDraftFile(id: number): Promise<void> {
  await fieldDb.files.delete(id);
}
