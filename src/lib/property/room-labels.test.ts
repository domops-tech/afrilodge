import { describe, expect, it } from "vitest";
import { canonicalRoomLabel, mergeRoomLabels, normalizeRoomLabel, ROOM_LABEL_MAX } from "./room-labels";

describe("normalizeRoomLabel", () => {
  it("nettoie les espaces et met la première lettre en majuscule", () => {
    expect(normalizeRoomLabel("  salon  ")).toBe("Salon");
    expect(normalizeRoomLabel("chambre   2")).toBe("Chambre 2");
  });
  it("renvoie une chaîne vide pour une saisie vide", () => {
    expect(normalizeRoomLabel("   ")).toBe("");
  });
  it("borne la longueur", () => {
    expect(normalizeRoomLabel("a".repeat(100))).toHaveLength(ROOM_LABEL_MAX);
  });
});

describe("canonicalRoomLabel", () => {
  const known = ["Salon", "Chambre 2", "Séjour"];
  it("réutilise la forme connue malgré la casse, les accents ou les espaces", () => {
    expect(canonicalRoomLabel("SALON", known)).toBe("Salon");
    expect(canonicalRoomLabel("chambre2", known)).toBe("Chambre 2");
    expect(canonicalRoomLabel("sejour", known)).toBe("Séjour");
  });
  it("accepte un nom nouveau, nettoyé", () => {
    expect(canonicalRoomLabel("  véranda ", known)).toBe("Véranda");
  });
  it("ne confond pas deux pièces numérotées différemment", () => {
    expect(canonicalRoomLabel("Chambre 22", known)).toBe("Chambre 22");
  });
});

describe("mergeRoomLabels", () => {
  it("supprime les doublons en gardant le premier et l'ordre", () => {
    expect(mergeRoomLabels(["Salon", "salon", ""], ["SÉJOUR", "Sejour", "Cuisine"])).toEqual(["Salon", "SÉJOUR", "Cuisine"]);
  });
});
