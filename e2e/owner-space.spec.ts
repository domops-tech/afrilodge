import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { test, expect } from "@playwright/test";

// Espace propriétaire (CDC §6.3). Utilise trois identités distinctes pour
// rester parallélisable sans course sur la file d'OTP (voir
// e2e/admin-review.spec.ts pour la même contrainte) : un propriétaire
// fraîchement inscrit, Fatou Diabaté (biens déjà publiés du seed) et
// Kouassi Yao (bien de test inséré directement pour ce fichier), plus le
// second compte admin dédié à ce fichier (prisma/seed.ts).
const NEW_ADMIN_PHONE = "+2250700000002";
const FATOU_PHONE = "+2250700000020";
const KOUASSI_PHONE = "+2250700000021";

async function requestAndReadOtp(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
  phone: string,
  fullName?: string
) {
  await page.getByLabel(/numéro de téléphone/i).fill(phone);
  await page.getByRole("button", { name: /envoyer le code/i }).click();
  await expect(page.getByText(new RegExp(phone.replace("+", "\\+")))).toBeVisible();

  const otpResponse = await request.get(`/api/dev/last-otp?phone=${encodeURIComponent(phone)}`);
  const { code } = await otpResponse.json();
  expect(code).toMatch(/^\d{6}$/);

  if (fullName) {
    await page.getByLabel(/nom complet/i).fill(fullName);
  }
  await page.getByLabel(/code reçu par sms/i).fill(code);
  await page.getByRole("button", { name: /vérifier/i }).click();
}

test("un propriétaire crée un bien, le demande en vérification, et l'admin planifie la visite", async ({
  page,
  request,
}) => {
  test.setTimeout(30_000);
  const ownerPhone = `+225070000${Math.floor(1000 + Math.random() * 8999)}`;

  // Première connexion : crée le compte propriétaire (CDC §5.2.16).
  await page.goto("/fr/connexion");
  await requestAndReadOtp(page, request, ownerPhone, "Propriétaire de Test");
  await expect(page).toHaveURL(/\/fr\/proprietaire$/);

  await page.getByRole("link", { name: /ajouter un bien/i }).click();
  await page.getByLabel(/^titre$/i).fill("Bien de test Sprint 4");
  await page.getByLabel(/description/i).fill("Un logement meublé pour le test de bout en bout.");
  await page.getByLabel(/quartier/i).fill("Cocody");
  await page.getByLabel(/^ville$/i).fill("Abidjan");
  await page.getByLabel(/prix/i).fill("12000");
  await page.getByLabel(/voyageurs maximum/i).fill("2");
  await page.getByRole("button", { name: /créer le bien/i }).click();

  await expect(page).toHaveURL(/\/fr\/proprietaire\/biens\/.+/);
  const propertyId = page.url().match(/\/biens\/([^/]+)/)?.[1];
  expect(propertyId).toBeTruthy();

  await page.getByRole("button", { name: /demander la vérification/i }).click();
  await expect(page.getByText(/demande envoyée, en attente de planification/i)).toBeVisible();

  // L'admin planifie la visite (CDC §4.1.2) — sans cette étape, la demande
  // n'aboutirait jamais (voir src/app/[locale]/(admin)/admin/actions.ts).
  await page.goto("/fr/admin/connexion");
  await requestAndReadOtp(page, request, NEW_ADMIN_PHONE);
  await expect(page).toHaveURL(/\/fr\/admin$/);

  const requestCard = page.getByTestId(`schedule-request-${propertyId}`);
  await requestCard.getByLabel(/agent/i).selectOption({ label: "Aïssata Koné" });
  await requestCard.getByLabel(/date de visite/i).fill("2027-01-15T10:00");
  await requestCard.getByRole("button", { name: /planifier/i }).click();

  // Cette action redirige aussi vers /admin, la page déjà affichée : ni
  // `toHaveURL` ni `waitForLoadState` ne sont un signal fiable pour une
  // soumission gérée côté client par le routeur RSC de Next.js (voir le
  // calendrier plus bas, même contrainte). On interroge la base avec
  // re-tentative — la session active est de toute façon celle de l'admin,
  // pas du propriétaire, donc rien à vérifier côté page ici.
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await expect(async () => {
      const result = await db.query(
        `SELECT vr.status, v."agentId", v."scheduledAt"
         FROM "VerificationRequest" vr
         JOIN "Visit" v ON v."verificationRequestId" = vr.id
         WHERE vr."propertyId" = $1`,
        [propertyId]
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].status).toBe("SCHEDULED");
      expect(result.rows[0].agentId).toBeTruthy();
    }).toPass({ timeout: 10_000 });
  } finally {
    await db.end();
  }
});

test("un propriétaire tient son calendrier de disponibilité", async ({ page, request }) => {
  test.setTimeout(30_000);

  await page.goto("/fr/connexion");
  await requestAndReadOtp(page, request, FATOU_PHONE);
  await expect(page).toHaveURL(/\/fr\/proprietaire$/);

  await page.getByRole("link", { name: /cocody angré/i }).click();
  await expect(page).toHaveURL(/\/fr\/proprietaire\/biens\/.+/);
  const propertyId = page.url().match(/\/biens\/([^/]+)/)?.[1];
  expect(propertyId).toBeTruthy();

  const target = new Date();
  target.setDate(target.getDate() + 5);
  const isoDate = target.toISOString().slice(0, 10);

  const dayCheckbox = page.locator(`input[name="blockedDate"][value="${isoDate}"]`);
  // .check()/.uncheck() plutôt que .click() se sont montrés peu fiables sur
  // nos cases à cocher ailleurs dans ce dépôt (voir e2e/field-visit.spec.ts) ;
  // .click() + assertion qui retente est le correctif éprouvé.
  await dayCheckbox.click({ force: true });
  await expect(dayCheckbox).toBeChecked();
  // La redirection ramène sur la MÊME URL : ni `toHaveURL` ni
  // `waitForLoadState("networkidle")` ne se sont montrés des signaux
  // fiables pour une soumission de formulaire gérée côté client par le
  // routeur de Next.js (RSC) plutôt qu'une navigation classique. On
  // interroge la base avec re-tentative plutôt que de deviner le bon
  // événement navigateur à attendre.
  await page.getByRole("button", { name: /enregistrer le calendrier/i }).click();

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await expect(async () => {
      const blocked = await db.query(
        `SELECT status FROM "AvailabilityDay" WHERE "propertyId" = $1 AND date = $2`,
        [propertyId, isoDate]
      );
      expect(blocked.rows).toHaveLength(1);
      expect(blocked.rows[0].status).toBe("BLOCKED");
    }).toPass({ timeout: 10_000 });
  } finally {
    await db.end();
  }

  // Décoche le même jour : l'absence de ligne redevient la convention OPEN
  // (voir décision — Sprint 3, filtrage de recherche). La page a été
  // re-rendue par le serveur suite à la soumission précédente : relocaliser
  // la case avant de cliquer.
  const dayCheckboxAfterReload = page.locator(`input[name="blockedDate"][value="${isoDate}"]`);
  await expect(dayCheckboxAfterReload).toBeChecked();
  await dayCheckboxAfterReload.click({ force: true });
  await expect(dayCheckboxAfterReload).not.toBeChecked();
  await page.getByRole("button", { name: /enregistrer le calendrier/i }).click();

  const db2 = new Client({ connectionString: process.env.DATABASE_URL });
  await db2.connect();
  try {
    await expect(async () => {
      const cleared = await db2.query(
        `SELECT status FROM "AvailabilityDay" WHERE "propertyId" = $1 AND date = $2`,
        [propertyId, isoDate]
      );
      expect(cleared.rows).toHaveLength(0);
    }).toPass({ timeout: 10_000 });
  } finally {
    await db2.end();
  }
});

test("un propriétaire voit le motif de refus et peut redemander une vérification", async ({
  page,
  request,
}) => {
  test.setTimeout(30_000);

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  let propertyId: string;
  try {
    const owner = await db.query(`SELECT id FROM "User" WHERE phone = $1`, [KOUASSI_PHONE]);
    const ownerId = owner.rows[0].id;
    propertyId = randomUUID();
    await db.query(
      `INSERT INTO "Property" (id, title, description, "pricePerNight", "maxGuests", neighborhood, city, status, "ownerId", "createdAt", "updatedAt")
       VALUES ($1, 'Bien refusé de test', 'Description de test pour le refus.', 8000, 2, 'Marcory', 'Abidjan', 'DRAFT', $2, now(), now())`,
      [propertyId, ownerId]
    );
    await db.query(
      `INSERT INTO "VerificationRequest" (id, status, "propertyId", "ownerId", "packPaid", "rejectionReason", "createdAt", "updatedAt")
       VALUES ($1, 'REJECTED', $2, $3, false, 'Photos insuffisantes pour statuer.', now(), now())`,
      [randomUUID(), propertyId, ownerId]
    );
  } finally {
    await db.end();
  }

  await page.goto("/fr/connexion");
  await requestAndReadOtp(page, request, KOUASSI_PHONE);
  await expect(page).toHaveURL(/\/fr\/proprietaire$/);

  await page.goto(`/fr/proprietaire/biens/${propertyId}`);
  await expect(page.getByText(/photos insuffisantes pour statuer/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /redemander une vérification/i })).toBeVisible();
});
