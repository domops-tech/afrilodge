import "dotenv/config";
import { randomUUID, createHmac } from "node:crypto";
import { Client } from "pg";
import { test, expect } from "@playwright/test";
import { isoDate, deleteProperty, setUpAcceptedBooking } from "./helpers/fixtures";

// Paiement, confirmation d'arrivée, libération des fonds et annulation
// (CDC §8, épic 6). Un propriétaire et un bien vérifié sont créés
// directement pour chaque test — voir e2e/helpers/fixtures.ts et l'entête
// d'e2e/booking-flow.spec.ts pour le raisonnement complet (numéros de
// téléphone aléatoires, bien nettoyé en fin de test, vérification par
// `pg` brut plutôt que le client Prisma généré).
//
// Le voyageur et le propriétaire agissent en parallèle sur la même
// réservation (le voyageur paie une fois le propriétaire accepté, confirme
// son arrivée après) : chacun garde son propre contexte navigateur, sans
// quoi la connexion du second écraserait le cookie de session du premier
// (un seul et même cookie `sejours_session` porte tous les rôles, voir
// src/lib/auth/session.ts).
//
// Le test de webhook (vérifié + idempotent) et celui de la libération des
// fonds sont volontairement séparés : le premier fabrique lui-même un
// événement « funds.held » signé, en contournant `simulatePayerCompletion`
// (voir src/lib/payments/simulated.ts) pour tester le webhook en
// isolation. Ça laisse l'état interne du simulateur (une Map en mémoire,
// distincte de la base) sur « pending », alors que `release()` exige
// « held » avant d'agir — cohérent avec un vrai PSP, dont le webhook et le
// grand livre interne ne peuvent jamais diverger. Le second test paie donc
// via le vrai bouton de l'interface pour garder cet état cohérent jusqu'à
// la confirmation d'arrivée.

function signWebhook(rawBody: string): string {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET ?? "";
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

test("paiement confirmé par webhook, vérifié et idempotent — commission créée", async ({
  page: guestPage,
  request,
  browser,
}) => {
  test.setTimeout(60_000);

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  let propertyId: string;

  try {
    const setup = await setUpAcceptedBooking({
      ownerPage,
      guestPage,
      request,
      ownerFullName: "Propriétaire Paiement",
      price: 300000,
      checkInOffsetDays: 10,
      nights: 2,
    });
    propertyId = setup.propertyId;
    const { bookingId, checkIn, checkOut } = setup;

    try {
      const db = new Client({ connectionString: process.env.DATABASE_URL });
      await db.connect();
      try {
        let providerIntentRef = "";
        await expect(async () => {
          const result = await db.query(
            `SELECT status, amount, "providerIntentRef" FROM "Payment" WHERE "bookingId" = $1`,
            [bookingId]
          );
          expect(result.rows).toHaveLength(1);
          expect(result.rows[0].status).toBe("INTENT_CREATED");
          expect(result.rows[0].amount).toBe(600000); // 2 nuits × 300 000 FCFA
          providerIntentRef = result.rows[0].providerIntentRef;
        }).toPass({ timeout: 20_000 });

        // Redirection vers l'établissement de paiement (CDC §6.2.3, épic 6.2) :
        // la page affiche bien le montant exact de l'intention créée.
        await guestPage.goto(`/fr/reserver/paiement/${bookingId}`);
        await expect(guestPage.getByText("600000 FCFA")).toBeVisible();

        // Webhook entrant : signature invalide rejetée (CDC §8.4, épic 6.3).
        const heldExternalId = randomUUID();
        const heldBody = JSON.stringify({ type: "funds.held", externalId: heldExternalId, providerIntentRef });
        const rejected = await request.post("/api/payments/webhook", {
          headers: { "x-webhook-signature": "signature-invalide" },
          data: heldBody,
        });
        expect(rejected.status()).toBe(401);

        // Webhook valide : traité, transitionne la réservation à PAID.
        const validSignature = signWebhook(heldBody);
        const accepted = await request.post("/api/payments/webhook", {
          headers: { "x-webhook-signature": validSignature },
          data: heldBody,
        });
        expect(accepted.status()).toBe(200);
        expect(await accepted.json()).toEqual({ processed: true });

        // Rejeu du même événement (même externalId) : idempotent, aucun doublon.
        const replayed = await request.post("/api/payments/webhook", {
          headers: { "x-webhook-signature": validSignature },
          data: heldBody,
        });
        expect(replayed.status()).toBe(200);
        expect(await replayed.json()).toEqual({ processed: false });

        await expect(async () => {
          const events = await db.query(`SELECT count(*) FROM "PaymentEvent" WHERE "externalId" = $1`, [
            heldExternalId,
          ]);
          expect(Number(events.rows[0].count)).toBe(1);

          const booking = await db.query(`SELECT status, "accessInfo" FROM "Booking" WHERE id = $1`, [bookingId]);
          expect(booking.rows[0].status).toBe("PAID");
          expect(booking.rows[0].accessInfo).toContain("GPS");

          const payment = await db.query(`SELECT status, "commissionAmount" FROM "Payment" WHERE "bookingId" = $1`, [
            bookingId,
          ]);
          expect(payment.rows[0].status).toBe("HELD");
          expect(payment.rows[0].commissionAmount).toBe(72000); // 12 % de 600 000

          const availability = await db.query(
            `SELECT status FROM "AvailabilityDay" WHERE "propertyId" = $1 AND date >= $2 AND date < $3`,
            [propertyId, isoDate(checkIn), isoDate(checkOut)]
          );
          expect(availability.rows).toHaveLength(2);
          expect(availability.rows.every((r) => r.status === "BOOKED")).toBe(true);

          const commission = await db.query(
            `SELECT amount, "settledAt" FROM "CommissionEntry" WHERE "bookingId" = $1`,
            [bookingId]
          );
          expect(commission.rows).toHaveLength(1);
          expect(commission.rows[0].amount).toBe(72000);
          expect(commission.rows[0].settledAt).toBeNull();
        }).toPass({ timeout: 20_000 });

        // Le voyageur voit la confirmation, le code de séjour et les
        // coordonnées d'accès — masqués jusque-là (CDC §5.1.6, §6.1.5).
        await guestPage.goto(`/fr/reserver/confirmation/${bookingId}`);
        await expect(guestPage.getByText(/réservation payée et confirmée/i)).toBeVisible();
        await expect(guestPage.getByText(/code de séjour/i)).toBeVisible();
        await expect(guestPage.getByText(/GPS/)).toBeVisible();
      } finally {
        await db.end();
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
  } finally {
    await ownerContext.close();
  }
});

test("paiement via l'interface, confirmation d'arrivée et libération des fonds", async ({
  page: guestPage,
  request,
  browser,
}) => {
  test.setTimeout(60_000);

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  let propertyId: string;

  try {
    const setup = await setUpAcceptedBooking({
      ownerPage,
      guestPage,
      request,
      ownerFullName: "Propriétaire Arrivée",
      price: 250000,
      checkInOffsetDays: 8,
      nights: 1,
    });
    propertyId = setup.propertyId;
    const { bookingId } = setup;

    try {
      const db = new Client({ connectionString: process.env.DATABASE_URL });
      await db.connect();
      try {
        await expect(async () => {
          const result = await db.query(`SELECT status FROM "Payment" WHERE "bookingId" = $1`, [bookingId]);
          expect(result.rows[0]?.status).toBe("INTENT_CREATED");
        }).toPass({ timeout: 20_000 });

        // Le voyageur paie via le vrai bouton de l'interface (CDC §6.2.3,
        // épic 6.2) — ce qui garde l'état interne du simulateur cohérent
        // pour la libération des fonds qui suit (voir l'entête du fichier).
        await guestPage.goto(`/fr/reserver/paiement/${bookingId}`);
        await guestPage.getByRole("button", { name: /payer via mobile money/i }).click();
        await expect(guestPage).toHaveURL(new RegExp(`/fr/reserver/confirmation/${bookingId}$`));
        await expect(guestPage.getByText(/réservation payée et confirmée/i)).toBeVisible();

        // Confirmation d'arrivée (CDC §5.1.7) → ordre de libération (§8.6, épic 6.4).
        await guestPage.getByRole("button", { name: /confirmer mon arrivée/i }).click();

        await expect(async () => {
          const booking = await db.query(`SELECT status, "arrivalConfirmedAt" FROM "Booking" WHERE id = $1`, [
            bookingId,
          ]);
          expect(booking.rows[0].status).toBe("IN_PROGRESS");
          expect(booking.rows[0].arrivalConfirmedAt).not.toBeNull();

          const payment = await db.query(`SELECT status FROM "Payment" WHERE "bookingId" = $1`, [bookingId]);
          expect(payment.rows[0].status).toBe("RELEASED");

          const commission = await db.query(`SELECT "settledAt" FROM "CommissionEntry" WHERE "bookingId" = $1`, [
            bookingId,
          ]);
          expect(commission.rows[0].settledAt).not.toBeNull();
        }).toPass({ timeout: 20_000 });
      } finally {
        await db.end();
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
  } finally {
    await ownerContext.close();
  }
});

test("annulation d'une réservation payée : remboursement selon la politique globale", async ({
  page: guestPage,
  request,
  browser,
}) => {
  test.setTimeout(60_000);

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  let propertyId: string;

  try {
    // Séjour largement au-delà du délai de remboursement intégral par
    // défaut (2 jours, voir src/lib/settings.ts) : l'annulation doit être
    // intégralement remboursée.
    const setup = await setUpAcceptedBooking({
      ownerPage,
      guestPage,
      request,
      ownerFullName: "Propriétaire Annulation",
      price: 400000,
      checkInOffsetDays: 15,
      nights: 1,
    });
    propertyId = setup.propertyId;
    const { bookingId, checkIn, checkOut } = setup;

    try {
      const db = new Client({ connectionString: process.env.DATABASE_URL });
      await db.connect();
      try {
        let providerIntentRef = "";
        await expect(async () => {
          const result = await db.query(`SELECT "providerIntentRef" FROM "Payment" WHERE "bookingId" = $1`, [
            bookingId,
          ]);
          expect(result.rows).toHaveLength(1);
          providerIntentRef = result.rows[0].providerIntentRef;
        }).toPass({ timeout: 20_000 });

        // Paiement posé directement via le webhook (déjà couvert en détail
        // par l'autre test de ce fichier) pour amener la réservation à PAID.
        // Sans risque pour la suite : `refund()` ne vérifie pas l'état
        // interne du simulateur, contrairement à `release()` (voir l'entête).
        const body = JSON.stringify({ type: "funds.held", externalId: randomUUID(), providerIntentRef });
        const response = await request.post("/api/payments/webhook", {
          headers: { "x-webhook-signature": signWebhook(body) },
          data: body,
        });
        expect(response.status()).toBe(200);

        await expect(async () => {
          const booking = await db.query(`SELECT status FROM "Booking" WHERE id = $1`, [bookingId]);
          expect(booking.rows[0].status).toBe("PAID");
        }).toPass({ timeout: 20_000 });

        await guestPage.goto(`/fr/reserver/confirmation/${bookingId}`);
        await guestPage.getByRole("button", { name: /annuler la réservation/i }).click();

        await expect(async () => {
          const booking = await db.query(`SELECT status FROM "Booking" WHERE id = $1`, [bookingId]);
          expect(booking.rows[0].status).toBe("CANCELLED");

          const payment = await db.query(`SELECT status FROM "Payment" WHERE "bookingId" = $1`, [bookingId]);
          expect(payment.rows[0].status).toBe("REFUNDED");

          const availability = await db.query(
            `SELECT status FROM "AvailabilityDay" WHERE "propertyId" = $1 AND date >= $2 AND date < $3`,
            [propertyId, isoDate(checkIn), isoDate(checkOut)]
          );
          expect(availability.rows).toHaveLength(0);

          const commission = await db.query(`SELECT id FROM "CommissionEntry" WHERE "bookingId" = $1`, [bookingId]);
          expect(commission.rows).toHaveLength(0);
        }).toPass({ timeout: 20_000 });

        // La redirection ramène sur la même URL déjà affichée (voir décision
        // 0009) : le rechargement explicite évite de dépendre du bon signal
        // de re-rendu côté routeur RSC pour cette dernière vérification.
        await guestPage.reload();
        await expect(guestPage.getByText(/cette demande a été annulée/i)).toBeVisible();
      } finally {
        await db.end();
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
  } finally {
    await ownerContext.close();
  }
});
