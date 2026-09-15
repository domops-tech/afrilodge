import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ property: vi.fn(), available: vi.fn(), create: vi.fn(), otp: vi.fn(), request: vi.fn() }));
vi.mock("@/lib/db/client", () => {
  const db = { property: { findUnique: mocks.property }, guestSession: { create: mocks.create } };
  return { prisma: { ...db, $transaction: (fn: (tx: typeof db) => unknown) => fn(db) } };
});
vi.mock("@/lib/booking/availability", () => ({ isRangeAvailable: mocks.available }));
vi.mock("@/lib/auth/otp", () => ({ verifyOtp: mocks.otp, requestOtp: mocks.request, OtpRateLimitError: class extends Error {} }));
vi.mock("@/lib/auth/session", () => ({ createGuestSession: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));
import { confirmBookingAction, requestGuestOtpAction } from "./actions";
const valid = { propertyId: "property", checkIn: "2030-01-01", checkOut: "2030-01-03", guests: "2", phone: "+2250700123456", fullName: "Voyageur", code: "123456" };
const published = { maxGuests: 4, status: "PUBLISHED", verification: { status: "ACTIVE", expiresAt: new Date("2031-01-01") } };
beforeEach(() => { vi.clearAllMocks(); mocks.property.mockResolvedValue(published); mocks.available.mockResolvedValue(true); mocks.otp.mockResolvedValue({ ok: true }); });
async function confirm(values: Partial<typeof valid> = {}) {
  const form = new FormData();
  for (const [k,v] of Object.entries({ ...valid, ...values })) form.set(k,v);
  return confirmBookingAction({ status: "idle" }, form);
}
describe("confirmation indépendante des étapes HTML précédentes", () => {
  it.each([
    { checkIn: "2020-01-01" }, { checkOut: "2029-01-01" }, { checkOut: "2030-01-01" },
    { checkIn: "2030-02-30" }, { guests: "10" }, { guests: "1.5" },
  ])("refuse les champs modifiés %o", async values => {
    expect((await confirm(values)).status).toBe("error");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.otp).not.toHaveBeenCalled();
  });
  it.each([
    { ...published, status: "UNPUBLISHED" },
    { ...published, verification: { status: "WITHDRAWN", expiresAt: new Date("2031-01-01") } },
    { ...published, verification: { status: "ACTIVE", expiresAt: new Date("2020-01-01") } },
    { ...published, maxGuests: 1 },
  ])("revalide dans la transaction après l'OTP", async revoked => {
    mocks.property.mockResolvedValueOnce(published).mockResolvedValueOnce(revoked);
    expect((await confirm()).status).toBe("error");
    expect(mocks.otp).toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

it("n’envoie pas de preuve téléphonique à une adresse email librement saisie", async () => {
  const form = new FormData();
  for (const [key,value] of Object.entries({ ...valid, email: "untrusted@example.com" })) form.set(key,value);
  expect((await requestGuestOtpAction({ status: "idle" }, form)).status).toBe("sent");
  expect(mocks.request).toHaveBeenCalledWith({ phone: valid.phone, purpose: "GUEST_BOOKING" });
});
