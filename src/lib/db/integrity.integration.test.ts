// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const shared = vi.hoisted(() => ({ db: null as unknown as PrismaClient, adminId: "" }));
vi.mock("@/lib/db/client", () => ({ prisma: new Proxy({}, {
  get: (_, key) => {
    const value = Reflect.get(shared.db, key);
    return typeof value === "function" ? value.bind(shared.db) : value;
  },
}) }));
vi.mock("@/lib/auth/guard", () => ({ requireRole: async () => ({ userId: shared.adminId, role: "ADMIN" }) }));
vi.mock("@/lib/auth/otp", () => ({ verifyOtp: async () => ({ ok: true }), requestOtp: vi.fn(), OtpRateLimitError: class extends Error {} }));
vi.mock("@/lib/auth/session", () => ({ createGuestSession: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));
import { acceptBooking } from "@/lib/booking/accept";
import { getPaymentProvider } from "@/lib/payments/simulated";
import { expireVerification } from "@/lib/verification/expire";
import { requestVerification } from "@/lib/verification/request";
import { approveVerificationAction, rejectVerificationAction } from "@/app/[locale]/(admin)/admin/fiches/[requestId]/actions";
import { confirmBookingAction } from "@/app/[locale]/(booking)/reserver/[propertyId]/actions";

// Opt-in: creates and removes only its own PostgreSQL schema; never seeds or
// migrates public. Uses the existing server, not the application's data.
describe.skipIf(process.env.RUN_DB_TESTS !== "1")("intégrité PostgreSQL et parcours métier", () => {
  const schema = `integrity_${randomUUID().replaceAll("-", "")}`;
  const sql = new Client({ connectionString: process.env.DATABASE_URL });
  let created = false;
  let ownerId: string;
  let agentId: string;

  beforeAll(async () => {
    await sql.connect();
    await sql.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    await sql.query(`SET search_path TO "${schema}"`);
    const migrations = (await readdir("prisma/migrations")).filter(x => /^\d/.test(x)).sort();
    for (const migration of migrations.slice(0, -1)) {
      await sql.query(await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"));
    }
    await sql.query(`INSERT INTO "User" (id,role,phone,email,"fullName","updatedAt") VALUES
      ('legacy-owner','OWNER','legacy-owner',' Owner@Example.com ','Owner',now()),
      ('duplicate','OWNER','duplicate','owner@example.com','Duplicate',now());
      INSERT INTO "Property" (id,title,description,"pricePerNight","maxGuests",neighborhood,city,"ownerId","updatedAt")
      VALUES ('legacy-property','Test','Test',100,2,'Test','Test','legacy-owner',now());
      INSERT INTO "GuestSession" (id,phone,"fullName","expiresAt") VALUES ('legacy-guest','guest','Guest',now());
      INSERT INTO "Booking" (id,"propertyId","guestSessionId","checkIn","checkOut",guests,"stayCode","updatedAt") VALUES
      ('legacy-paid','legacy-property','legacy-guest','2030-01-01','2030-01-03',1,'LEGACY1',now()),
      ('legacy-request','legacy-property','legacy-guest','2030-02-01','2030-02-03',1,'LEGACY2',now());
      INSERT INTO "Payment" (id,"bookingId","providerName","providerIntentRef",amount,"updatedAt")
      VALUES ('legacy-payment','legacy-paid','simulated','legacy-intent',777,now());`);
    const migration = await readFile(`prisma/migrations/${migrations.at(-1)}/migration.sql`, "utf8");
    await expect(sql.query(migration)).rejects.toThrow(/Duplicate normalized/);
    await sql.query("ROLLBACK");
    expect((await sql.query(`SELECT email FROM "User" WHERE id = 'legacy-owner'`)).rows[0].email).toBe(" Owner@Example.com ");
    await sql.query(`DELETE FROM "User" WHERE id = 'duplicate'`);
    await sql.query(migration);
    shared.db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` }, { schema }) });
    ownerId = (await shared.db.user.create({ data: { role: "OWNER", phone: "owner", fullName: "Owner" } })).id;
    agentId = (await shared.db.user.create({ data: { role: "AGENT", phone: "agent", fullName: "Agent" } })).id;
    shared.adminId = (await shared.db.user.create({ data: { role: "ADMIN", phone: "admin", fullName: "Admin" } })).id;
  }, 30_000);

  afterAll(async () => {
    if (shared.db) await shared.db.$disconnect();
    if (created) await sql.query(`DROP SCHEMA "${schema}" CASCADE`);
    await sql.end();
  });

  async function property(expiresAt = new Date("2031-01-01")) {
    const p = await shared.db.property.create({ data: {
      ownerId, title: "Test", description: "Test", city: "Test", neighborhood: "Test",
      pricePerNight: 100, maxGuests: 2, status: "PUBLISHED",
    } });
    const request = await shared.db.verificationRequest.create({ data: { propertyId: p.id, ownerId, status: "APPROVED" } });
    const visit = await shared.db.visit.create({ data: {
      verificationRequestId: request.id, agentId, scheduledAt: new Date("2026-01-01"), completedAt: new Date("2026-01-01"),
    } });
    await shared.db.verification.create({ data: { propertyId: p.id, visitId: visit.id, visitDate: visit.completedAt!, expiresAt } });
    return p;
  }

  async function booking() {
    const p = await property();
    const guest = await shared.db.guestSession.create({ data: { phone: randomUUID(), fullName: "Guest", expiresAt: new Date("2031-01-01") } });
    const b = await shared.db.booking.create({ data: {
      propertyId: p.id, guestSessionId: guest.id, checkIn: new Date("2030-01-01"), checkOut: new Date("2030-01-03"),
      guests: 1, totalAmount: 200, stayCode: randomUUID(), holdExpiresAt: new Date("2031-01-01"),
    } });
    return { bookingId: b.id, propertyId: p.id, ownerId };
  }

  it("préserve le montant PSP et trace la reconstruction des anciens prix", async () => {
    expect((await shared.db.booking.findUniqueOrThrow({ where: { id: "legacy-paid" } })).totalAmount).toBe(777);
    expect((await shared.db.booking.findUniqueOrThrow({ where: { id: "legacy-request" } })).totalAmount).toBe(200);
    expect(await shared.db.auditLog.count({ where: { action: "booking.price_backfilled" } })).toBe(2);
    expect((await shared.db.user.findUniqueOrThrow({ where: { id: "legacy-owner" } })).email).toBe("owner@example.com");
  });

  it("refuse les données incohérentes même en SQL direct", async () => {
    await expect(sql.query(`UPDATE "Booking" SET "checkOut" = "checkIn" WHERE id = 'legacy-paid'`)).rejects.toThrow(/Booking_valid_stay/);
    await expect(sql.query(`UPDATE "Property" SET "pricePerNight" = -1 WHERE id = 'legacy-property'`)).rejects.toThrow(/Property_positive/);
    await expect(sql.query(`UPDATE "Payment" SET "commissionAmount" = 9999 WHERE id = 'legacy-payment'`)).rejects.toThrow(/Payment_valid/);
    await expect(sql.query(`UPDATE "User" SET email = 'UPPER@example.com' WHERE id = 'legacy-owner'`)).rejects.toThrow(/User_email_normalized/);
    await expect(shared.db.user.update({ where: { id: ownerId }, data: { email: "owner@example.com" } })).rejects.toMatchObject({ code: "P2002" });
    await shared.db.user.update({ where: { id: agentId }, data: { email: "owner@example.com" } });
  });

  it("fige le total dès la demande puis conserve ce total après changement de tarif", async () => {
    const p = await property();
    const form = new FormData();
    Object.entries({ propertyId: p.id, checkIn: "2030-01-01", checkOut: "2030-01-03", guests: "1", phone: "+2250700112233", fullName: "Guest Test", code: "123456" }).forEach(([k,v]) => form.set(k,v));
    await expect(confirmBookingAction({ status: "idle" }, form)).rejects.toThrow("redirect");
    const b = await shared.db.booking.findFirstOrThrow({ where: { propertyId: p.id } });
    expect(b.totalAmount).toBe(200);
    await shared.db.property.update({ where: { id: p.id }, data: { pricePerNight: 900 } });
    await acceptBooking({ bookingId: b.id, propertyId: p.id, ownerId });
    expect((await shared.db.payment.findUniqueOrThrow({ where: { bookingId: b.id } })).amount).toBe(200);
  });

  it("une panne PSP laisse la demande réessayable et deux acceptations ne créent qu'un paiement", async () => {
    const params = await booking();
    const provider = getPaymentProvider();
    const spy = vi.spyOn(provider, "createIntent").mockRejectedValueOnce(new Error("PSP indisponible"));
    await expect(acceptBooking(params)).rejects.toThrow("PSP indisponible");
    expect((await shared.db.booking.findUniqueOrThrow({ where: { id: params.bookingId } })).status).toBe("REQUESTED");
    spy.mockRestore();
    await Promise.all([acceptBooking(params), acceptBooking(params)]);
    expect(await shared.db.payment.count({ where: { bookingId: params.bookingId } })).toBe(1);
    expect(await shared.db.auditLog.count({ where: { bookingId: params.bookingId, action: "booking.transition" } })).toBe(1);
  });

  it("une panne d'écriture après création PSP annule aussi l'acceptation et permet une reprise", async () => {
    const params = await booking();
    await sql.query(`CREATE FUNCTION reject_test_payment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test write failure'; END $$;
      CREATE TRIGGER reject_test_payment BEFORE INSERT ON "Payment" FOR EACH ROW EXECUTE FUNCTION reject_test_payment();`);
    try {
      await expect(acceptBooking(params)).rejects.toThrow();
      expect((await shared.db.booking.findUniqueOrThrow({ where: { id: params.bookingId } })).status).toBe("REQUESTED");
      expect(await shared.db.auditLog.count({ where: { bookingId: params.bookingId } })).toBe(0);
    } finally {
      await sql.query(`DROP TRIGGER reject_test_payment ON "Payment"; DROP FUNCTION reject_test_payment()`);
    }
    await acceptBooking(params);
    expect((await shared.db.payment.findUniqueOrThrow({ where: { bookingId: params.bookingId } })).providerIntentRef).toBe(`sim_${params.bookingId}`);
  });

  it("répare les anciennes acceptations sans paiement, refuse les demandes expirées ou étrangères", async () => {
    const params = await booking();
    await shared.db.booking.update({ where: { id: params.bookingId }, data: { status: "ACCEPTED" } });
    await acceptBooking(params);
    expect(await shared.db.payment.count({ where: { bookingId: params.bookingId } })).toBe(1);
    await expect(acceptBooking({ ...params, ownerId: "intruder" })).rejects.toThrow(/non éligible/);
    const expired = await booking();
    await shared.db.booking.update({ where: { id: expired.bookingId }, data: { holdExpiresAt: new Date(0) } });
    await expect(acceptBooking(expired)).rejects.toThrow(/non éligible/);
  });

  it("autorise un renouvellement après expiration, sans doublon concurrent, et archive la mention", async () => {
    const p = await property(new Date("2026-02-01"));
    const old = await shared.db.verification.findUniqueOrThrow({ where: { propertyId: p.id } });
    expect((await Promise.all([requestVerification(p.id, ownerId), requestVerification(p.id, ownerId)])).sort()).toEqual([false, true]);
    const request = await shared.db.verificationRequest.findFirstOrThrow({ where: { propertyId: p.id, status: "REQUESTED" } });
    const visit = await shared.db.visit.create({ data: { verificationRequestId: request.id, agentId, scheduledAt: new Date(), completedAt: new Date() } });
    await shared.db.verificationRequest.update({ where: { id: request.id }, data: { status: "VISITED" } });
    const form = new FormData(); form.set("requestId", request.id);
    await expect(approveVerificationAction({ status: "idle" }, form)).rejects.toThrow("redirect");
    const current = await shared.db.verification.findUniqueOrThrow({ where: { propertyId: p.id } });
    expect(current.id).toBe(old.id);
    expect(current.visitId).toBe(visit.id);
    expect(await expireVerification(shared.db, old, new Date())).toBe(false);
    expect(current.renewalReminderSentAt).toBeNull();
    const log = await shared.db.auditLog.findFirstOrThrow({ where: { entityId: old.id, action: "verification.renewed" } });
    expect(log.metadata).toMatchObject({ previous: { visitId: old.visitId } });
    expect((await shared.db.property.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PUBLISHED");
    await expect(approveVerificationAction({ status: "idle" }, form)).rejects.toThrow(/non éligible/);
  });

  it("conserve la publication pendant un renouvellement anticipé et refuse les visites incomplètes", async () => {
    const p = await property(new Date(Date.now() + 10 * 86400000));
    expect(await requestVerification(p.id, ownerId)).toBe(true);
    expect((await shared.db.property.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PUBLISHED");
    const request = await shared.db.verificationRequest.findFirstOrThrow({ where: { propertyId: p.id, status: "REQUESTED" } });
    await shared.db.visit.create({ data: { verificationRequestId: request.id, agentId, scheduledAt: new Date() } });
    await shared.db.verificationRequest.update({ where: { id: request.id }, data: { status: "VISITED" } });
    const form = new FormData(); form.set("requestId", request.id);
    await expect(approveVerificationAction({ status: "idle" }, form)).rejects.toThrow(/Visite complète/);
    expect(await requestVerification((await property()).id, ownerId)).toBe(false);
  });
  it("le refus d'un renouvellement conserve la mention valide jusqu'à son expiration", async () => {
    const p = await property(new Date(Date.now() + 10 * 86400000));
    await requestVerification(p.id, ownerId);
    const request = await shared.db.verificationRequest.findFirstOrThrow({ where: { propertyId: p.id, status: "REQUESTED" } });
    await shared.db.visit.create({ data: { verificationRequestId: request.id, agentId, scheduledAt: new Date(), completedAt: new Date() } });
    await shared.db.verificationRequest.update({ where: { id: request.id }, data: { status: "VISITED" } });
    const form = new FormData(); form.set("requestId", request.id); form.set("reason", "Nouvelle visite nécessaire");
    await expect(rejectVerificationAction({ status: "idle" }, form)).rejects.toThrow("redirect");
    expect((await shared.db.property.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PUBLISHED");
    const current = await shared.db.verification.findUniqueOrThrow({ where: { propertyId: p.id } });
    const future = new Date(Date.now() + 11 * 86400000);
    expect(await expireVerification(shared.db, current, future)).toBe(true);
    expect(await expireVerification(shared.db, current, future)).toBe(false);
    expect((await shared.db.property.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("UNPUBLISHED");
  });

});
