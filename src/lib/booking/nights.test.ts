import { describe, expect, it } from "vitest";
import { nightsInRange, isoDate } from "./nights";

describe("nightsInRange", () => {
  it("une nuit pour un séjour d'une journée", () => {
    const nights = nightsInRange(new Date("2026-10-01"), new Date("2026-10-02"));
    expect(nights.map(isoDate)).toEqual(["2026-10-01"]);
  });

  it("plusieurs nuits pour un séjour plus long", () => {
    const nights = nightsInRange(new Date("2026-10-01"), new Date("2026-10-04"));
    expect(nights.map(isoDate)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
  });

  it("aucune nuit si le départ n'est pas postérieur à l'arrivée", () => {
    expect(nightsInRange(new Date("2026-10-01"), new Date("2026-10-01"))).toHaveLength(0);
    expect(nightsInRange(new Date("2026-10-02"), new Date("2026-10-01"))).toHaveLength(0);
  });
});
