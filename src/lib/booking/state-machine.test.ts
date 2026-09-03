import { describe, expect, it } from "vitest";
import { isTransitionAllowed, type BookingStatus } from "./state-machine";

// Machine à états du CDC §7.2 : Demandée → Acceptée → Payée → En cours →
// Terminée, avec Annulée et Litige comme embranchements.
const ALL_STATUSES: BookingStatus[] = [
  "REQUESTED",
  "ACCEPTED",
  "PAID",
  "IN_PROGRESS",
  "DISPUTED",
  "COMPLETED",
  "CANCELLED",
];

describe("isTransitionAllowed — cycle nominal du CDC §7.2", () => {
  it.each([
    ["REQUESTED", "ACCEPTED"],
    ["ACCEPTED", "PAID"],
    ["PAID", "IN_PROGRESS"],
    ["IN_PROGRESS", "COMPLETED"],
  ] as const)("%s → %s est autorisé", (from, to) => {
    expect(isTransitionAllowed(from, to)).toBe(true);
  });
});

describe("isTransitionAllowed — annulation et litige", () => {
  it.each([
    ["REQUESTED", "CANCELLED"],
    ["ACCEPTED", "CANCELLED"],
    ["PAID", "CANCELLED"],
    ["PAID", "DISPUTED"],
    ["IN_PROGRESS", "DISPUTED"],
    ["COMPLETED", "DISPUTED"],
  ] as const)("%s → %s est autorisé", (from, to) => {
    expect(isTransitionAllowed(from, to)).toBe(true);
  });
});

describe("isTransitionAllowed — transitions refusées", () => {
  it.each([
    ["REQUESTED", "PAID"], // ne saute pas l'acceptation du propriétaire
    ["REQUESTED", "IN_PROGRESS"],
    ["ACCEPTED", "IN_PROGRESS"], // ne saute pas le paiement
    ["ACCEPTED", "COMPLETED"],
    ["COMPLETED", "IN_PROGRESS"], // pas de retour en arrière hors litige
    ["CANCELLED", "REQUESTED"], // état terminal
    ["CANCELLED", "PAID"],
  ] as const)("%s → %s est refusé", (from, to) => {
    expect(isTransitionAllowed(from, to)).toBe(false);
  });

  it("CANCELLED est un état terminal : aucune transition sortante", () => {
    for (const to of ALL_STATUSES) {
      if (to === "CANCELLED") continue;
      expect(isTransitionAllowed("CANCELLED", to)).toBe(false);
    }
  });
});
