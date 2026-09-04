import { describe, expect, it } from "vitest";
import {
  computeExpiresAt,
  isExpiredByClock,
  isReviewOverdue,
  isVerificationValid,
  needsRenewalReminder,
  RENEWAL_REMINDER_WINDOW_DAYS,
  VERIFICATION_VALIDITY_DAYS,
} from "./badge";

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

describe("isExpiredByClock", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("est vrai à l'instant exact de l'expiration", () => {
    expect(isExpiredByClock(now, now)).toBe(true);
  });

  it("est faux avant l'expiration", () => {
    expect(isExpiredByClock(new Date("2026-06-02T00:00:00.000Z"), now)).toBe(false);
  });
});

describe("needsRenewalReminder", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("relance une mention ACTIVE qui expire dans la fenêtre de 30 jours, jamais relancée", () => {
    expect(
      needsRenewalReminder(
        { status: "ACTIVE", expiresAt: new Date("2026-06-20T00:00:00.000Z"), renewalReminderSentAt: null },
        now
      )
    ).toBe(true);
  });

  it("ne relance pas si l'expiration est au-delà de la fenêtre", () => {
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + RENEWAL_REMINDER_WINDOW_DAYS + 1);
    expect(needsRenewalReminder({ status: "ACTIVE", expiresAt, renewalReminderSentAt: null }, now)).toBe(
      false
    );
  });

  it("ne relance pas deux fois", () => {
    expect(
      needsRenewalReminder(
        {
          status: "ACTIVE",
          expiresAt: new Date("2026-06-20T00:00:00.000Z"),
          renewalReminderSentAt: new Date("2026-05-25T00:00:00.000Z"),
        },
        now
      )
    ).toBe(false);
  });

  it("ne relance pas une mention déjà expirée ou retirée", () => {
    expect(
      needsRenewalReminder(
        { status: "EXPIRED", expiresAt: new Date("2026-06-20T00:00:00.000Z"), renewalReminderSentAt: null },
        now
      )
    ).toBe(false);
    expect(
      needsRenewalReminder(
        { status: "ACTIVE", expiresAt: new Date("2026-05-01T00:00:00.000Z"), renewalReminderSentAt: null },
        now
      )
    ).toBe(false);
  });
});

describe("isReviewOverdue", () => {
  const now = new Date("2026-06-02T00:00:00.000Z");

  it("est en retard au-delà de 24h (CDC §11.2)", () => {
    expect(isReviewOverdue(new Date("2026-05-31T23:00:00.000Z"), now)).toBe(true);
  });

  it("n'est pas en retard en-deçà de 24h", () => {
    expect(isReviewOverdue(new Date("2026-06-01T12:00:00.000Z"), now)).toBe(false);
  });
});
