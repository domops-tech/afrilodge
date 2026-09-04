import { randomUUID } from "node:crypto";
import { Client } from "pg";
import type { Page, APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";

// Partagé entre e2e/booking-flow.spec.ts et e2e/payment-flow.spec.ts — voir
// leurs commentaires d'en-tête pour le raisonnement complet (pourquoi un
// bien créé directement en base plutôt que rejouer le parcours terrain +
// admin, pourquoi des numéros aléatoires).

export const AGENT_ID_PHONE = "+2250700000010";

export function randomPhone(): string {
  return `+225070000${Math.floor(1000 + Math.random() * 8999)}`;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function loginAsOwner(
  page: Page,
  request: APIRequestContext,
  phone: string,
  fullName: string
) {
  await page.goto("/fr/connexion");
  await page.getByLabel(/numéro de téléphone/i).fill(phone);
  await page.getByRole("button", { name: /envoyer le code/i }).click();
  await expect(page.getByText(new RegExp(phone.replace("+", "\\+")))).toBeVisible();

  const otpResponse = await request.get(`/api/dev/last-otp?phone=${encodeURIComponent(phone)}`);
  const { code } = await otpResponse.json();
  expect(code).toMatch(/^\d{6}$/);

  await page.getByLabel(/nom complet/i).fill(fullName);
  await page.getByLabel(/code reçu par sms/i).fill(code);
  await page.getByRole("button", { name: /vérifier/i }).click();
  await expect(page).toHaveURL(/\/fr\/proprietaire$/);
}

/** Connexion admin — le compte doit déjà exister (pas d'auto-inscription, contrairement au propriétaire), voir e2e/admin-review.spec.ts. */
export async function loginAsAdmin(page: Page, request: APIRequestContext, phone: string) {
  await page.goto("/fr/admin/connexion");
  await page.getByLabel(/numéro de téléphone/i).fill(phone);
  await page.getByRole("button", { name: /envoyer le code/i }).click();
  await expect(page.getByText(new RegExp(phone.replace("+", "\\+")))).toBeVisible();

  const otpResponse = await request.get(`/api/dev/last-otp?phone=${encodeURIComponent(phone)}`);
  const { code } = await otpResponse.json();
  expect(code).toMatch(/^\d{6}$/);

  await page.getByLabel(/code reçu par sms/i).fill(code);
  await page.getByRole("button", { name: /vérifier/i }).click();
  await expect(page).toHaveURL(/\/fr\/admin$/);
}

export async function bookAsGuest(
  page: Page,
  request: APIRequestContext,
  params: { propertyId: string; checkIn: string; checkOut: string; guestPhone: string; guestName: string }
) {
  const { propertyId, checkIn, checkOut, guestPhone, guestName } = params;

  await page.goto(`/fr/reserver/${propertyId}`);
  await page.getByLabel(/date d'arrivée/i).fill(checkIn);
  await page.getByLabel(/date de départ/i).fill(checkOut);
  await page.getByRole("button", { name: /continuer/i }).click();

  await page.getByLabel(/nom complet/i).fill(guestName);
  await page.getByLabel(/numéro de téléphone/i).fill(guestPhone);
  await page.getByRole("button", { name: /envoyer le code/i }).click();
  await expect(page.getByText(new RegExp(guestPhone.replace("+", "\\+")))).toBeVisible();

  const otpResponse = await request.get(`/api/dev/last-otp?phone=${encodeURIComponent(guestPhone)}`);
  const { code } = await otpResponse.json();
  expect(code).toMatch(/^\d{6}$/);

  await page.getByLabel(/code reçu par sms/i).fill(code);
  await page.getByRole("button", { name: /confirmer la demande/i }).click();
  await expect(page).toHaveURL(/\/fr\/reserver\/confirmation\/.+/);

  return page.url().match(/\/confirmation\/([^/]+)/)?.[1] as string;
}

/**
 * Bien publié et vérifié créé directement en base — une visite terrain
 * complète (Sprint 1) puis une validation admin (Sprint 2) alourdiraient
 * ces tests sans rien ajouter à ce qu'ils vérifient (réservation, paiement).
 * `price` par défaut délibérément hors budget des filtres
 * d'e2e/public-search.spec.ts qui tourne en parallèle (voir sa note d'en-tête).
 */
export async function createVerifiedProperty(
  db: Client,
  ownerId: string,
  agentId: string,
  price = 500000
): Promise<string> {
  const propertyId = randomUUID();
  const requestId = randomUUID();
  const visitId = randomUUID();
  const verificationId = randomUUID();
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const inOneYear = new Date();
  inOneYear.setDate(inOneYear.getDate() + 300);

  await db.query(
    `INSERT INTO "Property" (id, title, description, "pricePerNight", "maxGuests", neighborhood, city, "accessLandmarks", latitude, longitude, status, "ownerId", "createdAt", "updatedAt")
     VALUES ($1, 'Bien vérifié de test', 'Logement meublé pour les tests de bout en bout.', $2, 4, 'Cocody', 'Abidjan', 'Repère de test à 100m du carrefour.', 5.36, -3.94, 'PUBLISHED', $3, now(), now())`,
    [propertyId, price, ownerId]
  );
  await db.query(
    `INSERT INTO "VerificationRequest" (id, status, "propertyId", "ownerId", "packPaid", "createdAt", "updatedAt")
     VALUES ($1, 'APPROVED', $2, $3, true, now(), now())`,
    [requestId, propertyId, ownerId]
  );
  await db.query(
    `INSERT INTO "Visit" (id, "scheduledAt", "startedAt", "completedAt", "checkInAt", "verificationRequestId", "agentId", "createdAt", "updatedAt")
     VALUES ($1, $2, $2, $2, $2, $3, $4, now(), now())`,
    [visitId, tenDaysAgo, requestId, agentId]
  );
  await db.query(
    `INSERT INTO "Verification" (id, status, "visitDate", "expiresAt", "propertyId", "visitId", "createdAt", "updatedAt")
     VALUES ($1, 'ACTIVE', $2, $3, $4, $5, now(), now())`,
    [verificationId, tenDaysAgo, inOneYear, propertyId, visitId]
  );

  return propertyId;
}

/** `Booking.property` n'a pas de cascade : les réservations doivent être supprimées avant le bien. */
export async function deleteProperty(db: Client, propertyId: string) {
  await db.query(`DELETE FROM "Booking" WHERE "propertyId" = $1`, [propertyId]);
  await db.query(`DELETE FROM "Property" WHERE id = $1`, [propertyId]);
}

/**
 * Bien + demande + acceptation, jusqu'à l'intention de paiement — partagé
 * par e2e/payment-flow.spec.ts et e2e/dispute-flow.spec.ts, qui ont toutes
 * deux besoin d'une réservation ACCEPTED comme point de départ.
 */
export async function setUpAcceptedBooking(params: {
  ownerPage: Page;
  guestPage: Page;
  request: APIRequestContext;
  ownerFullName: string;
  price: number;
  checkInOffsetDays: number;
  nights: number;
}) {
  const { ownerPage, guestPage, request, ownerFullName, price, checkInOffsetDays, nights } = params;
  const ownerPhone = randomPhone();
  await loginAsOwner(ownerPage, request, ownerPhone, ownerFullName);

  const setupDb = new Client({ connectionString: process.env.DATABASE_URL });
  await setupDb.connect();
  let propertyId: string;
  try {
    const owner = await setupDb.query(`SELECT id FROM "User" WHERE phone = $1`, [ownerPhone]);
    const agent = await setupDb.query(`SELECT id FROM "User" WHERE phone = $1`, [AGENT_ID_PHONE]);
    propertyId = await createVerifiedProperty(setupDb, owner.rows[0].id, agent.rows[0].id, price);
  } finally {
    await setupDb.end();
  }

  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + checkInOffsetDays);
  const checkOut = new Date();
  checkOut.setDate(checkOut.getDate() + checkInOffsetDays + nights);

  const guestPhone = randomPhone();
  const bookingId = await bookAsGuest(guestPage, request, {
    propertyId,
    checkIn: isoDate(checkIn),
    checkOut: isoDate(checkOut),
    guestPhone,
    guestName: "Voyageur de Test",
  });

  await ownerPage.goto(`/fr/proprietaire/biens/${propertyId}`);
  await ownerPage.getByTestId(`booking-${bookingId}`).getByRole("button", { name: /^accepter$/i }).click();

  return { propertyId, bookingId, checkIn, checkOut };
}

/**
 * `acceptBookingAction` crée l'intention de paiement en même temps que la
 * transition — la page de paiement 404 tant qu'elle n'a pas encore
 * committé (`Payment.status !== "INTENT_CREATED"`). À appeler après
 * `setUpAcceptedBooking` et avant toute navigation vers
 * `/reserver/paiement/[bookingId]`.
 */
export async function waitForPaymentIntent(bookingId: string): Promise<void> {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await expect(async () => {
      const result = await db.query(`SELECT status FROM "Payment" WHERE "bookingId" = $1`, [bookingId]);
      expect(result.rows[0]?.status).toBe("INTENT_CREATED");
    }).toPass({ timeout: 20_000 });
  } finally {
    await db.end();
  }
}

/** Paie via le vrai bouton de l'interface puis confirme l'arrivée — voir décision 0012 sur pourquoi jamais un webhook fabriqué à la main quand la suite dépend de `release()`. */
export async function payAndConfirmArrival(guestPage: Page, bookingId: string) {
  await waitForPaymentIntent(bookingId);
  await guestPage.goto(`/fr/reserver/paiement/${bookingId}`);
  await guestPage.getByRole("button", { name: /payer via mobile money/i }).click();
  await expect(guestPage).toHaveURL(new RegExp(`/fr/reserver/confirmation/${bookingId}$`));
  await guestPage.getByRole("button", { name: /confirmer mon arrivée/i }).click();
}
