import "dotenv/config";
import { randomUUID, createHmac } from "node:crypto";
import { Client } from "pg";
import { test, expect } from "@playwright/test";
import { setUpAcceptedBooking, waitForPaymentIntent, deleteProperty, bookAsGuest, isoDate, randomPhone } from "./helpers/fixtures";

test("récupération OTP, deux réservations et arrivée prématurée", async ({ page, request, browser }) => {
  test.setTimeout(60000);
  const ownerContext = await browser.newContext();
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  let propertyId: string | undefined;
  try {
    const setup = await setUpAcceptedBooking({ ownerPage: await ownerContext.newPage(), guestPage: page, request, ownerFullName: "QA récupération", price: 600000, checkInOffsetDays: 8, nights: 2 });
    propertyId = setup.propertyId;
    await waitForPaymentIntent(setup.bookingId);
    await page.goto(`/fr/reserver/paiement/${setup.bookingId}`);
    await page.getByRole("button", { name: /payer via mobile money/i }).click();
    await expect(page).toHaveURL(new RegExp(`/confirmation/${setup.bookingId}$`));
    await expect(page.getByRole("button", { name: /confirmer mon arrivée/i })).toHaveCount(0);
    await expect(page.getByText(/confirmation d’arrivée sera disponible/i)).toBeVisible();
    expect((await db.query('SELECT status FROM "Payment" WHERE "bookingId"=$1', [setup.bookingId])).rows[0].status).toBe("HELD");
    const phone = (await db.query('SELECT g.phone FROM "GuestSession" g JOIN "Booking" b ON b."guestSessionId"=g.id WHERE b.id=$1', [setup.bookingId])).rows[0].phone;
    const second = await bookAsGuest(page, request, { propertyId, checkIn: isoDate(new Date(Date.now()+15*86400000)), checkOut: isoDate(new Date(Date.now()+16*86400000)), guestPhone: phone, guestName: "Voyageur QA" });
    await page.goto(`/fr/reserver/confirmation/${setup.bookingId}`);
    await expect(page.getByText(/réservation payée et confirmée/i)).toBeVisible();
    // Lost/expired cookie: recover the exact destination through a new SMS code.
    await page.context().clearCookies();
    await page.goto(`/fr/reserver/confirmation/${setup.bookingId}`);
    await expect(page).toHaveURL(/\/fr\/reserver\?retour=/);
    await page.getByLabel(/numéro de téléphone/i).fill(phone);
    await page.getByRole("button", { name: /envoyer le code/i }).click();
    await expect(page.getByText(phone, { exact: false })).toBeVisible();
    const { code } = await (await request.get(`/api/dev/last-otp?phone=${encodeURIComponent(phone)}`)).json();
    await page.getByLabel(/code reçu par sms/i).fill(code);
    await page.getByRole("button", { name: /retrouver mes réservations/i }).click();
    await expect(page).toHaveURL(new RegExp(`/confirmation/${setup.bookingId}$`));
    await page.goto('/fr/reserver');
    await expect(page.locator(`a[href$="/${setup.bookingId}"]`)).toBeVisible();
    await expect(page.locator(`a[href$="/${second}"]`)).toBeVisible();
    const outsider = await browser.newContext();
    try { const anonymous = await outsider.newPage(); await anonymous.goto(`/fr/reserver/confirmation/${second}`); await expect(anonymous.getByLabel(/numéro de téléphone/i)).toBeVisible();
      await bookAsGuest(anonymous, request, { propertyId, checkIn: isoDate(new Date(Date.now()+30*86400000)), checkOut: isoDate(new Date(Date.now()+31*86400000)), guestPhone: randomPhone(), guestName: "Autre voyageur" });
      const denied = await anonymous.goto(`/fr/reserver/confirmation/${setup.bookingId}`);
      expect(denied?.status()).toBe(404); } finally { await outsider.close(); }
  } finally { if (propertyId) await deleteProperty(db, propertyId); await db.end(); await ownerContext.close(); }
});

test("webhook interrompu : rollback complet puis rejeu concurrent sans doublon", async ({ page, request, browser }) => {
  test.setTimeout(60000);
  const ownerContext = await browser.newContext();
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
  let propertyId: string | undefined;
  try {
    const setup = await setUpAcceptedBooking({ ownerPage: await ownerContext.newPage(), guestPage: page, request, ownerFullName: "QA webhook", price: 610000, checkInOffsetDays: 8, nights: 1 });
    propertyId = setup.propertyId; await waitForPaymentIntent(setup.bookingId);
    const payment = (await db.query('SELECT * FROM "Payment" WHERE "bookingId"=$1', [setup.bookingId])).rows[0];
    const externalId = randomUUID();
    const raw = JSON.stringify({ externalId, type: "funds.held", providerIntentRef: payment.providerIntentRef });
    const headers = { 'content-type': 'application/json', 'x-webhook-signature': createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET!).update(raw).digest('hex') };
    // A deliberately conflicting commission fails late, after the status writes.
    await db.query('INSERT INTO "CommissionEntry" (id,"bookingId",amount,rate,"createdAt") VALUES ($1,$2,1,0.1,now())', [randomUUID(),setup.bookingId]);
    const failed = await request.post('/api/payments/webhook', { data: raw, headers });
    expect(failed.status()).toBe(500);
    expect((await db.query('SELECT status FROM "Booking" WHERE id=$1', [setup.bookingId])).rows[0].status).toBe('ACCEPTED');
    expect((await db.query('SELECT status FROM "Payment" WHERE id=$1', [payment.id])).rows[0].status).toBe('INTENT_CREATED');
    expect((await db.query('SELECT id FROM "PaymentEvent" WHERE "externalId"=$1', [externalId])).rowCount).toBe(0);
    expect((await db.query('SELECT status FROM "AvailabilityDay" WHERE "bookingId"=$1', [setup.bookingId])).rows[0].status).toBe('HELD');
    expect((await db.query('SELECT id FROM "AuditLog" WHERE "bookingId"=$1 AND metadata->>\'to\'=\'PAID\'', [setup.bookingId])).rowCount).toBe(0);
    await db.query('DELETE FROM "CommissionEntry" WHERE "bookingId"=$1', [setup.bookingId]);
    const retries = await Promise.all([1,2].map(() => request.post('/api/payments/webhook', { data: raw, headers })));
    expect(retries.map(r => r.status())).toEqual([200,200]);
    expect((await db.query('SELECT status FROM "Booking" WHERE id=$1', [setup.bookingId])).rows[0].status).toBe('PAID');
    expect((await db.query('SELECT id FROM "CommissionEntry" WHERE "bookingId"=$1', [setup.bookingId])).rowCount).toBe(1);
  } finally { if (propertyId) await deleteProperty(db,propertyId); await db.end(); await ownerContext.close(); }
});

test("filtres conservés et dates incohérentes expliquées", async ({ page }) => {
  const arrivee = isoDate(new Date(Date.now()+20*86400000)), depart = isoDate(new Date(Date.now()+22*86400000));
  await page.goto(`/fr/recherche?arrivee=${arrivee}&depart=${depart}&voyageurs=2&budget=100000`);
  await page.locator('a[href*="/logements/"]').first().click();
  await page.getByRole('link', { name: /^réserver$/i }).first().click();
  await expect(page.getByLabel(/date d'arrivée/i)).toHaveValue(arrivee);
  await expect(page.getByLabel(/date de départ/i)).toHaveValue(depart);
  await expect(page.getByLabel(/voyageurs/i)).toHaveValue('2');
  await page.goto(`/fr/recherche?arrivee=${depart}&depart=${arrivee}`);
  await expect(page.getByRole('alert').filter({ hasText: 'Vérifiez les dates' })).toContainText('Vérifiez les dates');
  await expect(page.locator('a[href*="/logements/"]')).toHaveCount(0);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.locator('a button')).toHaveCount(0);
});

test("le dernier jour du calendrier conserve ses verrous malgré un formulaire modifié", async ({ page, request, browser }) => {
  test.setTimeout(60000);
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect();
  let propertyId: string | undefined;
  try {
    const setup = await setUpAcceptedBooking({ ownerPage, guestPage: page, request, ownerFullName: "QA calendrier", price: 650000, checkInOffsetDays: 59, nights: 1 });
    propertyId = setup.propertyId;
    const date = isoDate(setup.checkIn);
    for (const status of ['HELD', 'BOOKED']) {
      await db.query('UPDATE "AvailabilityDay" SET status=$1 WHERE "bookingId"=$2', [status, setup.bookingId]);
      await ownerPage.goto(`/fr/proprietaire/biens/${propertyId}`);
      const field = ownerPage.locator(`input[name="blockedDate"][value="${date}"]`);
      await expect(field).toBeDisabled();
      const navigation = ownerPage.waitForResponse(response => response.request().method() === 'POST');
      await field.evaluate((input: HTMLInputElement) => {
        const hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = 'blockedDate'; hidden.value = input.value;
        input.form!.append(hidden); input.form!.requestSubmit();
      });
      await navigation;
      expect((await db.query('SELECT status FROM "AvailabilityDay" WHERE "bookingId"=$1', [setup.bookingId])).rows[0].status).toBe(status);
    }
  } finally { if (propertyId) await deleteProperty(db,propertyId); await db.end(); await ownerContext.close(); }
});
