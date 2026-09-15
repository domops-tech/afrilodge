import "dotenv/config";
import { Client } from "pg";
import { test, expect } from "@playwright/test";

// Voir e2e/field-visit.spec.ts pour l'explication de ce choix : le client
// Prisma généré (ESM pur) ne s'importe pas depuis un fichier de test
// Playwright compilé en CommonJS, la vérification finale passe par `pg`.

import { visitFixture } from "./helpers/visit-fixture";
let fixture: Awaited<ReturnType<typeof visitFixture>>;
let ADMIN_PHONE: string;
test.beforeEach(async () => { fixture = await visitFixture(true); ADMIN_PHONE = fixture.adminPhone; });
test.afterEach(async () => { await fixture?.cleanup(); });

async function loginAsAdmin(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
  await page.goto("/fr/admin/connexion");
  await page.getByLabel(/numéro de téléphone/i).fill(ADMIN_PHONE);
  // Match exact : voir e2e/helpers/fixtures.ts, loginAsAdmin, pour la même
  // ambiguïté depuis l'ajout de la connexion email admin.
  await page.getByRole("button", { name: "Envoyer le code", exact: true }).click();
  await expect(page.getByText(new RegExp(ADMIN_PHONE.replace("+", "\\+")))).toBeVisible();

  const otpResponse = await request.get(`/api/dev/last-otp?phone=${encodeURIComponent(ADMIN_PHONE)}`);
  const { code } = await otpResponse.json();
  expect(code).toMatch(/^\d{6}$/);

  await page.getByLabel(/code reçu par sms/i).fill(code);
  await page.getByRole("button", { name: /vérifier/i }).click();
  await expect(page).toHaveURL(/\/fr\/admin$/);
}

test.describe("validation d'une fiche par le back-office (CDC §4.1.8)", () => {
  // Les deux tests s'authentifient avec le même numéro admin : en série,
  // pas en parallèle, sinon la demande de code de l'un peut écraser celle
  // de l'autre (même numéro = même file d'OTP). Représente aussi mieux le
  // cas réel : un admin traite plusieurs fiches dans une même session.
  test.describe.configure({ mode: "serial" });

  test("approuve une fiche visitée : la mention est attribuée et le bien publié", async ({ page, request }) => {
    await loginAsAdmin(page, request);

    await page.getByRole("link", { name: new RegExp(fixture.title) }).click();
    await expect(page).toHaveURL(/\/fr\/admin\/fiches\/.+/);
    const requestId = page.url().match(/\/fiches\/([^/]+)/)?.[1];
    expect(requestId).toBeTruthy();

    // Tout ce que l'agent a constaté est visible avant la décision — y
    // compris les photos elles-mêmes chargées (pas juste présentes dans le
    // DOM : next/image sert une image cassée sans erreur HTML visible si
    // l'optimiseur refuse l'URL, voir next.config.ts `dangerouslyAllowLocalIP`).
    await expect(page.getByText("Écart : annoncé mais non constaté")).toBeVisible();
    const firstPhoto = page.getByRole("img").first();
    await expect(firstPhoto).toBeVisible();
    await expect(async () => {
      expect(await firstPhoto.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    }).toPass({ timeout: 20_000 });

    await page.getByRole("button", { name: /approuver et publier/i }).click();
    await expect(page).toHaveURL(/\/fr\/admin$/);
    await expect(page.getByRole("link", { name: new RegExp(fixture.title) })).toHaveCount(0);

    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
      const req = await db.query('SELECT status, "propertyId" FROM "VerificationRequest" WHERE id = $1', [
        requestId,
      ]);
      expect(req.rows[0].status).toBe("APPROVED");

      const property = await db.query('SELECT status FROM "Property" WHERE id = $1', [
        req.rows[0].propertyId,
      ]);
      expect(property.rows[0].status).toBe("PUBLISHED");

      const verification = await db.query(
        'SELECT "visitDate", "expiresAt", status FROM "Verification" WHERE "propertyId" = $1',
        [req.rows[0].propertyId]
      );
      expect(verification.rows).toHaveLength(1);
      expect(verification.rows[0].status).toBe("ACTIVE");
      const visitDate = new Date(verification.rows[0].visitDate);
      const expiresAt = new Date(verification.rows[0].expiresAt);
      const diffDays = Math.round((expiresAt.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(365);
    } finally {
      await db.end();
    }
  });

  test("refuse une fiche visitée avec motif : le bien reste non publié", async ({ page, request }) => {
    await loginAsAdmin(page, request);

    await page.getByRole("link", { name: new RegExp(fixture.title) }).click();
    await expect(page).toHaveURL(/\/fr\/admin\/fiches\/.+/);
    const requestId = page.url().match(/\/fiches\/([^/]+)/)?.[1];

    await page.getByRole("button", { name: /^refuser$/i }).click();
    await page.getByLabel(/motif du refus/i).fill("Écarts trop importants avec l'annonce.");
    await page.getByRole("button", { name: /^refuser$/i }).click();
    await expect(page).toHaveURL(/\/fr\/admin$/);

    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
      const req = await db.query('SELECT status, "propertyId" FROM "VerificationRequest" WHERE id = $1', [
        requestId,
      ]);
      expect(req.rows[0].status).toBe("REJECTED");

      const property = await db.query('SELECT status FROM "Property" WHERE id = $1', [
        req.rows[0].propertyId,
      ]);
      expect(property.rows[0].status).toBe("DRAFT");

      const auditLog = await db.query(
        `SELECT metadata FROM "AuditLog" WHERE action = 'verification.rejected' AND "entityId" = $1`,
        [requestId]
      );
      expect(auditLog.rows).toHaveLength(1);
      expect(auditLog.rows[0].metadata.reason).toContain("Écarts");
    } finally {
      await db.end();
    }
  });
});
