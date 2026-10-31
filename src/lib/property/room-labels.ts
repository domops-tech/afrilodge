export const ROOM_LABEL_MAX = 40;

/** Nettoie un nom de pièce saisi à la main : espaces normalisés, longueur bornée, première lettre en majuscule. */
export function normalizeRoomLabel(input: string): string {
  const cleaned = input.replace(/\s+/g, " ").trim().slice(0, ROOM_LABEL_MAX).trim();
  return cleaned ? cleaned.charAt(0).toLocaleUpperCase() + cleaned.slice(1) : "";
}

const fold = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");

/** Renvoie la forme déjà connue si la saisie n'en diffère que par la casse, les accents ou les espaces ; sinon la saisie nettoyée. */
export function canonicalRoomLabel(input: string, known: readonly string[]): string {
  const normalized = normalizeRoomLabel(input);
  if (!normalized) return "";
  const key = fold(normalized);
  return known.find(label => fold(label) === key) ?? normalized;
}

/** Fusionne plusieurs listes de noms de pièces sans doublon (casse, accents et espaces ignorés), en gardant l'ordre. */
export function mergeRoomLabels(...lists: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const list of lists) {
    for (const label of list) {
      const normalized = normalizeRoomLabel(label);
      const key = fold(normalized);
      if (!normalized || !key || seen.has(key)) continue;
      seen.add(key);
      merged.push(normalized);
    }
  }
  return merged;
}
