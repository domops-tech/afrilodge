import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { test, expect } from "@playwright/test";

// Réservation bout en bout (CDC §6.2, épic 5) : sélection de dates avec
// disponibilité temps réel (5.1), verrouillage du calendrier (5.2),
// identification du voyageur par OTP sans compte (5.3), acceptation par le
// propriétaire (5.4). Le client Prisma généré (ESM pur) ne s'importe pas
// depuis un fichier de test Playwright compilé en CommonJS (voir
// e2e/field-visit.spec.ts) : la vérification passe par `pg` brut.
//
// Un propriétaire et un bien sont créés directement pour ce fichier — un
// bien vérifié et publié suppose normalement une visite terrain complète
// (Sprint 1) puis une validation admin (Sprint 2) ; rejouer ces deux
// parcours ici alourdirait ce test sans rien ajouter à ce qu'il vérifie
// (la réservation), donc l'état "publié et vérifié" est posé directement en
// base, comme le fait déjà e2e/owner-space.spec.ts pour un bien refusé.
// Numéros de téléphone tirés au hasard (propriétaire et voyageur) : aucune
// collision possible avec les autres fichiers, qui utilisent des numéros
// fixes du jeu de démonstration (voir la même précaution dans
// e2e/owner-space.spec.ts). Le bien créé est supprimé en fin de test (voir
// plus bas) : e2e/public-search.spec.ts compte précisément le nombre de
// biens vérifiés publiés, et les fichiers de test tournent en parallèle sur
// la même base — un bien laissé derrière fausserait ce compte.

const AGENT_ID_PHONE = "+2250700000010"; // agent du jeu de démonstration, seulement référencé comme FK de la visite

function randomPhone() {
  return `+225070000${Math.floor(1000 + Math.random() * 8999)}`;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function loginAsOwner(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
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

async function bookAsGuest(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
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

  return page.url().match(/\/confirmation\/([^/]+)/)?.[1];
}

/** Bien publié et vérifié créé directement en base pour ce test — voir l'entête du fichier. */
async function createVerifiedProperty(db: Client, ownerId: string, agentId: string): Promise<string> {
  const propertyId = randomUUID();
  const requestId = randomUUID();
  const visitId = randomUUID();
  const verificationId = randomUUID();
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const inOneYear = new Date();
  inOneYear.setDate(inOneYear.getDate() + 300);

  // Prix délibérément élevé et hors du quartier "Angré" : ce bien ne doit
  // jamais entrer dans les résultats filtrés d'e2e/public-search.spec.ts,
  // qui tourne en parallèle sur la même base (voir sa note d'en-tête sur le
  // total non filtré).
  await db.query(
    `INSERT INTO "Property" (id, title, description, "pricePerNight", "maxGuests", neighborhood, city, status, "ownerId", "createdAt", "updatedAt")
     VALUES ($1, 'Bien vérifié de test Sprint 5', 'Logement meublé pour le test de réservation.', 500000, 4, 'Cocody', 'Abidjan', 'PUBLISHED', $2, now(), now())`,
    [propertyId, ownerId]
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

/** `Booking.property` n'a pas de cascade (contrairement à VerificationRequest/Verification/AvailabilityDay) : les réservations doivent être supprimées avant le bien. */
async function deleteProperty(db: Client, propertyId: string) {
  await db.query(`DELETE FROM "Booking" WHERE "propertyId" = $1`, [propertyId]);
  await db.query(`DELETE FROM "Property" WHERE id = $1`, [propertyId]);
}

test("un voyageur réserve sans compte, le propriétaire accepte puis refuse une autre demande", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);

  const ownerPhone = randomPhone();

  // Le propriétaire s'inscrit normalement (première connexion, CDC
  // §5.2.16) : c'est la seule partie de la mise en place qui passe par
  // l'interface plutôt que par SQL direct, pour garder un compte réel.
  await loginAsOwner(page, request, ownerPhone, "Propriétaire Réservation");

  const setupDb = new Client({ connectionString: process.env.DATABASE_URL });
  await setupDb.connect();
  let propertyId: string;
  try {
    const owner = await setupDb.query(`SELECT id FROM "User" WHERE phone = $1`, [ownerPhone]);
    const agent = await setupDb.query(`SELECT id FROM "User" WHERE phone = $1`, [AGENT_ID_PHONE]);
    propertyId = await createVerifiedProperty(setupDb, owner.rows[0].id, agent.rows[0].id);
  } finally {
    await setupDb.end();
  }

  try {
    // Première demande : dates acceptées ensuite par le propriétaire.
    const acceptCheckIn = new Date();
    acceptCheckIn.setDate(acceptCheckIn.getDate() + 10);
    const acceptCheckOut = new Date();
    acceptCheckOut.setDate(acceptCheckOut.getDate() + 12);

    const guestPhone = randomPhone();
    const bookingStart = Date.now();
    const bookingId = await bookAsGuest(page, request, {
      propertyId,
      checkIn: isoDate(acceptCheckIn),
      checkOut: isoDate(acceptCheckOut),
      guestPhone,
      guestName: "Voyageur de Test",
    });
    const bookingDurationMs = Date.now() - bookingStart;
    expect(bookingId).toBeTruthy();

    // CDC §11.3 : réservation en moins de 3 minutes sur Android d'entrée de
    // gamme. Le temps mesuré ici est celui d'une exécution automatisée
    // (Playwright ne simule pas la saisie humaine ni la lecture d'un SMS
    // réel) : le seuil est délibérément généreux, c'est un garde-fou contre
    // une régression de performance pathologique du tunnel, pas une mesure
    // d'ergonomie humaine réelle — même principe que la chronométrie du
    // Sprint 1 (voir e2e/field-visit.spec.ts).
    expect(bookingDurationMs).toBeLessThan(45_000);

    await expect(page.getByText(/en attente d'acceptation par le propriétaire/i)).toBeVisible();

    const dbAfterRequest = new Client({ connectionString: process.env.DATABASE_URL });
    await dbAfterRequest.connect();
    try {
      const booking = await dbAfterRequest.query(`SELECT status FROM "Booking" WHERE id = $1`, [bookingId]);
      expect(booking.rows[0].status).toBe("REQUESTED");

      const held = await dbAfterRequest.query(
        `SELECT status FROM "AvailabilityDay" WHERE "propertyId" = $1 AND date >= $2 AND date < $3 ORDER BY date`,
        [propertyId, isoDate(acceptCheckIn), isoDate(acceptCheckOut)]
      );
      expect(held.rows).toHaveLength(2);
      expect(held.rows.every((r) => r.status === "HELD")).toBe(true);
    } finally {
      await dbAfterRequest.end();
    }

    // Second voyageur (numéro distinct), dates distinctes : demande refusée
    // ensuite par le propriétaire.
    const refuseCheckIn = new Date();
    refuseCheckIn.setDate(refuseCheckIn.getDate() + 20);
    const refuseCheckOut = new Date();
    refuseCheckOut.setDate(refuseCheckOut.getDate() + 21);

    const secondGuestPhone = randomPhone();
    const refusedBookingId = await bookAsGuest(page, request, {
      propertyId,
      checkIn: isoDate(refuseCheckIn),
      checkOut: isoDate(refuseCheckOut),
      guestPhone: secondGuestPhone,
      guestName: "Second Voyageur de Test",
    });
    expect(refusedBookingId).toBeTruthy();

    // Le propriétaire se reconnecte (le cookie de session a basculé côté
    // voyageur pendant les réservations ci-dessus) pour traiter les deux
    // demandes.
    await loginAsOwner(page, request, ownerPhone, "Propriétaire Réservation");
    await page.goto(`/fr/proprietaire/biens/${propertyId}`);

    const acceptedCard = page.getByTestId(`booking-${bookingId}`);
    await acceptedCard.getByRole("button", { name: /^accepter$/i }).click();

    const dbAfterAccept = new Client({ connectionString: process.env.DATABASE_URL });
    await dbAfterAccept.connect();
    try {
      // Cette action redirige vers la MÊME URL déjà affichée : signal
      // navigateur non fiable pour une soumission gérée côté client par le
      // routeur RSC de Next.js (voir e2e/owner-space.spec.ts, même
      // contrainte documentée en décision 0009). On interroge la base avec
      // re-tentative.
      await expect(async () => {
        const result = await dbAfterAccept.query(`SELECT status FROM "Booking" WHERE id = $1`, [bookingId]);
        expect(result.rows[0].status).toBe("ACCEPTED");
      }).toPass({ timeout: 20_000 });

      // Le calendrier reste verrouillé (HELD) après acceptation : il ne
      // deviendra BOOKED qu'au paiement (Sprint 6, épic 5.2/6).
      const stillHeld = await dbAfterAccept.query(
        `SELECT status FROM "AvailabilityDay" WHERE "propertyId" = $1 AND date >= $2 AND date < $3`,
        [propertyId, isoDate(acceptCheckIn), isoDate(acceptCheckOut)]
      );
      expect(stillHeld.rows.every((r) => r.status === "HELD")).toBe(true);
    } finally {
      await dbAfterAccept.end();
    }

    await page.goto(`/fr/proprietaire/biens/${propertyId}`);
    const refusedCard = page.getByTestId(`booking-${refusedBookingId}`);
    await refusedCard.getByRole("button", { name: /^refuser$/i }).click();

    const dbAfterRefuse = new Client({ connectionString: process.env.DATABASE_URL });
    await dbAfterRefuse.connect();
    try {
      await expect(async () => {
        const result = await dbAfterRefuse.query(`SELECT status FROM "Booking" WHERE id = $1`, [refusedBookingId]);
        expect(result.rows[0].status).toBe("CANCELLED");
      }).toPass({ timeout: 20_000 });

      // Le refus libère immédiatement le calendrier — absence de ligne =
      // OPEN (convention établie au Sprint 3), sans attendre l'expiration
      // du verrou (scripts/expire-booking-holds.ts).
      const released = await dbAfterRefuse.query(
        `SELECT status FROM "AvailabilityDay" WHERE "propertyId" = $1 AND date >= $2 AND date < $3`,
        [propertyId, isoDate(refuseCheckIn), isoDate(refuseCheckOut)]
      );
      expect(released.rows).toHaveLength(0);
    } finally {
      await dbAfterRefuse.end();
    }
  } finally {
    const cleanupDb = new Client({ connectionString: process.env.DATABASE_URL });
    await cleanupDb.connect();
    try {
      await deleteProperty(cleanupDb, propertyId);
    } finally {
      await cleanupDb.end();
    }
  }
});
