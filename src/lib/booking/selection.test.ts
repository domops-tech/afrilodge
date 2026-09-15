import { describe, it, expect } from "vitest";
import { dateOnlySchema, validStayRange, selectionQuery } from "./selection";
import { hasArrivalDateStarted } from "./arrival";

describe("dates de séjour", () => {
  it.each(["2026-02-30", "2026-01-01T12:00:00Z", "", "invalid"])("refuse %s", value => {
    expect(dateOnlySchema.safeParse(value).success).toBe(false);
  });
  it("refuse le passé, les dates égales et inversées", () => {
    const today = new Date("2026-09-14T17:00:00Z");
    for (const [a,b] of [["2026-09-13","2026-09-15"],["2026-09-15","2026-09-15"],["2026-09-16","2026-09-15"]]) {
      expect(validStayRange(new Date(a), new Date(b), today)).toBe(false);
    }
    expect(validStayRange(new Date("2026-09-14"), new Date("2026-09-15"), today)).toBe(true);
  });
  it("n'autorise l'arrivée qu'à partir de minuit UTC prévu", () => {
    const arrival = new Date("2026-09-15");
    expect(hasArrivalDateStarted(arrival, new Date("2026-09-14T23:59:59Z"))).toBe(false);
    expect(hasArrivalDateStarted(arrival, new Date("2026-09-15T00:00:00Z"))).toBe(true);
  });
  it("ne propage que les filtres prévus et encode leur contenu", () => {
    expect(selectionQuery({ quartier: "A & B", budget: "0", retour: "https://example.com", arrivee: ["a","b"] })).toBe("?quartier=A+%26+B&budget=0");
  });
});
