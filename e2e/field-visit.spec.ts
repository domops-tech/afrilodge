import "dotenv/config";
import path from "node:path";
import { Client } from "pg";
import { test, expect } from "@playwright/test";

// Playwright transpile ses fichiers de test en CommonJS par défaut
// (`package.json` sans `"type": "module"`) : __dirname y est disponible,
// contrairement à `import.meta.url` réservé à l'ESM. Pour la même raison,
// la vérification finale interroge la base via `pg` directement plutôt que
// via le client Prisma généré (pur ESM), dont l'import depuis un fichier
// de test CJS échoue à l'exécution — voir docs/agile/decisions/0005.
const SAMPLE_IMAGE = path.join(__dirname, "fixtures/sample.jpg");

// Agent 2 du seed (prisma/seed.ts), assigné à la visite "en attente" du
// bien Plateau (VerificationRequest.status = SCHEDULED).
const AGENT_PHONE = "+2250700000011";

const FIXED_SLOTS = ["FACADE", "ENTREE", "SANITAIRES", "CUISINE", "VUE", "ACCES"];

test.describe("visite terrain hors connexion (CDC §4, §6.4, §11.1)", () => {
  test.use({
    permissions: ["geolocation"],
    geolocation: { latitude: 5.316667, longitude: -4.033333 },
  });

  test("un agent réalise une visite complète hors connexion et elle remonte au serveur", async ({
    page,
    request,
    context,
  }) => {
    test.setTimeout(60_000);

    // Connexion agent (compte provisionné par le seed, pas d'auto-inscription).
    await page.goto("/fr/terrain/connexion");
    await page.getByLabel(/numéro de téléphone/i).fill(AGENT_PHONE);
    await page.getByRole("button", { name: /envoyer le code/i }).click();

    // Attend que la Server Action ait terminé (transition vers l'étape du
    // code) avant d'interroger la route de secours — sans ça, la requête
    // part en course avec l'envoi du SMS simulé.
    await expect(page.getByText(new RegExp(AGENT_PHONE.replace("+", "\\+")))).toBeVisible();

    const otpResponse = await request.get(`/api/dev/last-otp?phone=${encodeURIComponent(AGENT_PHONE)}`);
    const { code } = await otpResponse.json();
    expect(code).toMatch(/^\d{6}$/);

    await page.getByLabel(/code reçu par sms/i).fill(code);
    await page.getByRole("button", { name: /vérifier/i }).click();
    await expect(page).toHaveURL(/\/fr\/terrain$/);

    // Ouvre la visite assignée (bien "Plateau" du seed).
    await page.getByRole("link", { name: /studio cosy, plateau/i }).click();
    await expect(page).toHaveURL(/\/fr\/terrain\/visite\/.+/);
    const visitId = page.url().match(/\/visite\/([^/]+)/)?.[1];
    expect(visitId).toBeTruthy();

    // Démarre la visite : horodatage + géolocalisation (CDC §4.1.3).
    await page.getByTestId("start-visit").click();

    // À partir d'ici, plus aucun appel réseau jusqu'à la synchronisation
    // finale — c'est exactement ce que ce test vérifie (CDC §6.4.4).
    await context.setOffline(true);
    await expect(page.getByTestId("offline-badge")).toBeVisible();

    for (const slot of FIXED_SLOTS) {
      await page.getByTestId(`capture-${slot}`).click();
      await page.getByTestId("photo-input-fixed").setInputFiles(SAMPLE_IMAGE);
    }
    await page.getByLabel(/nom de la pièce/i).fill("Salon");
    await page.getByTestId("add-room-photo").click();
    await page.getByTestId("photo-input-room").setInputFiles(SAMPLE_IMAGE);
    await page.getByTestId("photos-continue").click();

    // Équipements : un écart délibéré (un équipement annoncé mais absent).
    // .click() plutôt que .uncheck() : la mise à jour passe par IndexedDB
    // (async), et .uncheck() n'attend pas la re-synchronisation React du
    // même souffle — l'assertion qui suit, elle, retente jusqu'à confirmation.
    const firstAmenityCheckbox = page.locator('input[type="checkbox"]').first();
    await firstAmenityCheckbox.click();
    await expect(firstAmenityCheckbox).not.toBeChecked();
    await page.getByTestId("amenities-continue").click();

    await page.getByTestId("landmarks-input").fill("À 200 m de la pharmacie principale.");
    await page.getByTestId("landmarks-input").blur();
    await page.getByTestId("landmarks-continue").click();

    await page.getByTestId("capture-identity").click();
    await page.getByTestId("photo-input-identity").setInputFiles(SAMPLE_IMAGE);
    await page.getByTestId("capture-title").click();
    await page.getByTestId("photo-input-title").setInputFiles(SAMPLE_IMAGE);
    const identityCheckbox = page.getByTestId("identity-verified-checkbox");
    await identityCheckbox.click();
    await expect(identityCheckbox).toBeChecked();
    await page.getByTestId("identity-continue").click();

    // Termine la visite hors connexion : doit rester en attente localement.
    await page.getByTestId("complete-visit").click();
    await expect(page.getByTestId("pending-sync-message")).toBeVisible();

    // Retour du réseau : la synchronisation applicative reprend d'elle-même
    // (voir src/lib/field/sync.ts — pas l'API Background Sync du navigateur).
    await context.setOffline(false);
    await expect(page.getByTestId("sync-success-message")).toBeVisible({ timeout: 15_000 });

    // Preuve que le cycle a bien remonté jusqu'au serveur.
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
      const visitRow = await db.query(
        `SELECT v."completedAt", vr.status AS request_status
         FROM "Visit" v
         JOIN "VerificationRequest" vr ON vr.id = v."verificationRequestId"
         WHERE v.id = $1`,
        [visitId]
      );
      expect(visitRow.rows).toHaveLength(1);
      expect(visitRow.rows[0].completedAt).not.toBeNull();
      expect(visitRow.rows[0].request_status).toBe("VISITED");

      const photoCount = await db.query('SELECT count(*)::int FROM "VisitPhoto" WHERE "visitId" = $1', [
        visitId,
      ]);
      expect(photoCount.rows[0].count).toBe(FIXED_SLOTS.length + 1);

      const identityCount = await db.query('SELECT count(*)::int FROM "IdentityCheck" WHERE "visitId" = $1', [
        visitId,
      ]);
      expect(identityCount.rows[0].count).toBe(1);

      const discrepancy = await db.query(
        'SELECT count(*)::int FROM "AmenityCheck" WHERE "visitId" = $1 AND observed = false',
        [visitId]
      );
      expect(discrepancy.rows[0].count).toBeGreaterThan(0);
    } finally {
      await db.end();
    }
  });
});
