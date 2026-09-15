import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { test, expect } from "@playwright/test";
import {
  randomPhone,
  loginAsAdmin,
  setUpAcceptedBooking,
  payAndConfirmArrival,
  deleteProperty,
} from "./helpers/fixtures";

// Litiges : signalement, contre-visite, retrait de mention, résolution
// directe (CDC §4.2 dernier point, §6.5.3, épic 7). Un compte admin dédié
// est créé directement en base pour chaque test (l'admin ne s'auto-inscrit
// pas, contrairement au propriétaire — voir e2e/admin-review.spec.ts) :
// évite toute collision d'OTP avec les admins fixes des autres fichiers
// (+2250700000001, +2250700000002).
//
// La contre-visite elle-même n'est pas rejouée via l'app terrain complète
// (hors connexion, capture photo…) : ce parcours est déjà exhaustivement
// couvert par e2e/field-visit.spec.ts, le refaire ici n'ajouterait rien à
// ce que ce fichier vérifie (litiges). La visite est marquée complétée
// directement en base, comme si l'agent venait de synchroniser — seule la
// planification (réutilise `ScheduleForm` existant) et la décision finale
// (nouvelle, propre à ce sprint) sont rejouées via l'interface.

async function createAdmin(db: Client): Promise<string> {
  const phone = randomPhone();
  await db.query(
    `INSERT INTO "User" (id, role, phone, "fullName", "createdAt", "updatedAt")
     VALUES ($1, 'ADMIN', $2, 'Admin Litiges de Test', now(), now())`,
    [randomUUID(), phone]
  );
  return phone;
}

/** Le litige et toute contre-visite qu'il a déclenchée doivent disparaître avant le bien : `Dispute.property` n'a pas de cascade. */
async function cleanupDispute(db: Client, propertyId: string) {
  await db.query(`DELETE FROM "Dispute" WHERE "propertyId" = $1`, [propertyId]);
  await deleteProperty(db, propertyId);
}

test("signalement, contre-visite, écart confirmé : la mention est retirée", async ({
  page: guestPage,
  request,
  browser,
}) => {
  test.setTimeout(60_000);

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  let propertyId: string;

  try {
    const setup = await setUpAcceptedBooking({
      ownerPage,
      guestPage,
      request,
      ownerFullName: "Propriétaire Litige",
      price: 350000,
      checkInOffsetDays: 0,
      nights: 1,
    });
    propertyId = setup.propertyId;
    const { bookingId } = setup;

    try {
      await payAndConfirmArrival(guestPage, bookingId);
      await expect(guestPage.getByText(/séjour en cours/i)).toBeVisible();

      // Signalement d'écart (CDC §4.2 dernier point, épic 7.1).
      await guestPage.getByLabel(/décrivez l'écart constaté/i).fill("La climatisation annoncée est absente.");
      await guestPage.getByRole("button", { name: /signaler un problème/i }).click();
      await expect(guestPage.getByText(/en cours de traitement/i)).toBeVisible();

      const db = new Client({ connectionString: process.env.DATABASE_URL });
      await db.connect();
      try {
        let disputeId = "";
        await expect(async () => {
          const result = await db.query(`SELECT id, status FROM "Dispute" WHERE "bookingId" = $1`, [bookingId]);
          expect(result.rows).toHaveLength(1);
          expect(result.rows[0].status).toBe("OPEN");
          disputeId = result.rows[0].id;
        }).toPass({ timeout: 20_000 });

        const adminPhone = await createAdmin(db);
        await loginAsAdmin(adminPage, request, adminPhone);

        // Déclenchement d'une contre-visite (CDC §6.5.3, épic 7.2). Les
        // litiges sont une liste globale, pas propre à cet admin : d'autres
        // fichiers de test peuvent en avoir un ouvert en même temps, d'où
        // le ciblage par testid plutôt qu'un bouton générique de la page.
        await adminPage.goto("/fr/admin/litiges");
        const disputeCard = adminPage.getByTestId(`dispute-${disputeId}`);
        await expect(disputeCard.getByText("La climatisation annoncée est absente.")).toBeVisible();
        await disputeCard.getByRole("button", { name: /déclencher une contre-visite/i }).click();

        let counterVisitRequestId = "";
        await expect(async () => {
          const result = await db.query(`SELECT status, "counterVisitRequestId" FROM "Dispute" WHERE id = $1`, [
            disputeId,
          ]);
          expect(result.rows[0].status).toBe("COUNTER_VISIT_SCHEDULED");
          expect(result.rows[0].counterVisitRequestId).toBeTruthy();
          counterVisitRequestId = result.rows[0].counterVisitRequestId;
        }).toPass({ timeout: 20_000 });

        // La contre-visite est une VerificationRequest comme une autre :
        // même file de planification admin, même formulaire (épic 7.2).
        await adminPage.goto("/fr/admin");
        await expect(adminPage.getByText(/contre-visite — litige/i)).toBeVisible();
        const scheduleCard = adminPage.getByTestId(`schedule-request-${propertyId}`);
        await scheduleCard.getByLabel(/agent/i).selectOption({ label: "Aïssata Koné" });
        await scheduleCard.getByLabel(/date de visite/i).fill("2027-02-01T10:00");
        await scheduleCard.getByRole("button", { name: /planifier/i }).click();

        await expect(async () => {
          const result = await db.query(`SELECT status FROM "VerificationRequest" WHERE id = $1`, [
            counterVisitRequestId,
          ]);
          expect(result.rows[0].status).toBe("SCHEDULED");
        }).toPass({ timeout: 20_000 });

        // La visite elle-même (capture, hors connexion…) est déjà couverte
        // par e2e/field-visit.spec.ts — on la marque complétée directement,
        // comme le ferait la synchronisation applicative.
        const now = new Date();
        await db.query(
          `UPDATE "Visit" SET "startedAt" = $2, "completedAt" = $2, "checkInAt" = $2 WHERE "verificationRequestId" = $1`,
          [counterVisitRequestId, now]
        );
        await db.query(`UPDATE "VerificationRequest" SET status = 'VISITED' WHERE id = $1`, [counterVisitRequestId]);
        await db.query(
          `INSERT INTO "AmenityCheck" (id, "visitId", "amenityName", announced, observed)
           SELECT $1, v.id, 'Climatisation', true, false FROM "Visit" v WHERE v."verificationRequestId" = $2`,
          [randomUUID(), counterVisitRequestId]
        );

        // Décision de la contre-visite (CDC §6.5.3, épic 7.3) — un panneau
        // différent de l'approbation/refus normale (voir
        // fiches/[requestId]/DisputeReviewPanel : une nouvelle Verification
        // ne peut de toute façon pas être créée, celle en place doit être
        // retirée).
        await adminPage.goto(`/fr/admin/fiches/${counterVisitRequestId}`);
        await expect(adminPage.getByText(/la climatisation annoncée est absente/i)).toBeVisible();
        await adminPage.getByRole("button", { name: /écart confirmé — retirer la mention/i }).click();

        await expect(async () => {
          const property = await db.query(`SELECT status FROM "Property" WHERE id = $1`, [propertyId]);
          expect(property.rows[0].status).toBe("UNPUBLISHED");

          const verification = await db.query(`SELECT status FROM "Verification" WHERE "propertyId" = $1`, [
            propertyId,
          ]);
          expect(verification.rows[0].status).toBe("WITHDRAWN");

          const disputeRow = await db.query(`SELECT status FROM "Dispute" WHERE id = $1`, [disputeId]);
          expect(disputeRow.rows[0].status).toBe("RESOLVED_WITHDRAWN");
        }).toPass({ timeout: 20_000 });

        await guestPage.goto(`/fr/reserver/confirmation/${bookingId}`);
        await expect(guestPage.getByText(/mention.*a été retirée/i)).toBeVisible();
      } finally {
        await db.end();
      }
    } finally {
      const cleanupDb = new Client({ connectionString: process.env.DATABASE_URL });
      await cleanupDb.connect();
      try {
        await cleanupDispute(cleanupDb, propertyId);
      } finally {
        await cleanupDb.end();
      }
    }
  } finally {
    await ownerContext.close();
    await adminContext.close();
  }
});

test("résolution directe d'un litige, sans contre-visite : la mention est maintenue", async ({
  page: guestPage,
  request,
  browser,
}) => {
  test.setTimeout(60_000);

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  let propertyId: string;

  try {
    const setup = await setUpAcceptedBooking({
      ownerPage,
      guestPage,
      request,
      ownerFullName: "Propriétaire Litige Direct",
      price: 320000,
      checkInOffsetDays: 0,
      nights: 1,
    });
    propertyId = setup.propertyId;
    const { bookingId } = setup;

    try {
      await payAndConfirmArrival(guestPage, bookingId);
      await guestPage.getByLabel(/décrivez l'écart constaté/i).fill("Le voisinage est bruyant, non annoncé.");
      await guestPage.getByRole("button", { name: /signaler un problème/i }).click();

      const db = new Client({ connectionString: process.env.DATABASE_URL });
      await db.connect();
      try {
        let disputeId = "";
        await expect(async () => {
          const result = await db.query(`SELECT id, status FROM "Dispute" WHERE "bookingId" = $1`, [bookingId]);
          expect(result.rows).toHaveLength(1);
          expect(result.rows[0].status).toBe("OPEN");
          disputeId = result.rows[0].id;
        }).toPass({ timeout: 20_000 });

        const adminPhone = await createAdmin(db);
        await loginAsAdmin(adminPage, request, adminPhone);

        // Traitement des litiges au back-office (CDC §6.5.3, épic 7.4) :
        // le voisinage n'est pas quelque chose qu'une contre-visite peut
        // vérifier — résolu directement, sans agent, mention maintenue.
        await adminPage.goto("/fr/admin/litiges");
        const disputeCard = adminPage.getByTestId(`dispute-${disputeId}`);
        await expect(disputeCard.getByText("Le voisinage est bruyant, non annoncé.")).toBeVisible();
        await disputeCard.getByLabel(/motif de la décision/i).fill("Nuisance sonore hors du champ de la vérification.");
        await disputeCard.getByRole("button", { name: /maintenir la mention/i }).click();

        await expect(async () => {
          const disputeRow = await db.query(`SELECT status, "resolutionNote" FROM "Dispute" WHERE id = $1`, [
            disputeId,
          ]);
          expect(disputeRow.rows[0].status).toBe("RESOLVED_KEPT");
          expect(disputeRow.rows[0].resolutionNote).toContain("Nuisance");

          const property = await db.query(`SELECT status FROM "Property" WHERE id = $1`, [propertyId]);
          expect(property.rows[0].status).toBe("PUBLISHED");

          const verification = await db.query(`SELECT status FROM "Verification" WHERE "propertyId" = $1`, [
            propertyId,
          ]);
          expect(verification.rows[0].status).toBe("ACTIVE");
        }).toPass({ timeout: 20_000 });

        await guestPage.goto(`/fr/reserver/confirmation/${bookingId}`);
        await expect(guestPage.getByText(/mention.*est maintenue/i)).toBeVisible();
      } finally {
        await db.end();
      }
    } finally {
      const cleanupDb = new Client({ connectionString: process.env.DATABASE_URL });
      await cleanupDb.connect();
      try {
        await cleanupDispute(cleanupDb, propertyId);
      } finally {
        await cleanupDb.end();
      }
    }
  } finally {
    await ownerContext.close();
    await adminContext.close();
  }
});
