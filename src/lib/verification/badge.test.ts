import { describe, expect, it } from "vitest";
import { computeExpiresAt, isVerificationValid, VERIFICATION_VALIDITY_DAYS } from "./badge";

describe("computeExpiresAt", () => {
  it("ajoute exactement 12 mois (365 jours) à la date de visite (CDC §4.2)", () => {
    const visitDate = new Date("2026-01-15T10:00:00.000Z");
    const expires = computeExpiresAt(visitDate);

    const diffDays = (expires.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(VERIFICATION_VALIDITY_DAYS);
  });
});

describe("isVerificationValid", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("est valide si ACTIVE et non expirée", () => {
    expect(
      isVerificationValid(
        { status: "ACTIVE", expiresAt: new Date("2026-12-01T00:00:00.000Z") },
        now
      )
    ).toBe(true);
  });

  it("est invalide si la date d'expiration est dépassée, même si le statut est encore ACTIVE", () => {
    expect(
      isVerificationValid(
        { status: "ACTIVE", expiresAt: new Date("2026-01-01T00:00:00.000Z") },
        now
      )
    ).toBe(false);
  });

  it("est invalide si retirée (WITHDRAWN), même non expirée", () => {
    expect(
      isVerificationValid(
        { status: "WITHDRAWN", expiresAt: new Date("2026-12-01T00:00:00.000Z") },
        now
      )
    ).toBe(false);
  });

  it("est invalide si EXPIRED", () => {
    expect(
      isVerificationValid(
        { status: "EXPIRED", expiresAt: new Date("2026-12-01T00:00:00.000Z") },
        now
      )
    ).toBe(false);
  });
});
