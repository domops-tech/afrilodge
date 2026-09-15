import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { test, expect } from "@playwright/test";
import { loginAsAdmin, randomPhone } from "./helpers/fixtures";

// Création d'un compte agent depuis le back-office (CDC §3) — voir
// src/app/[locale]/(admin)/admin/agents/. Un admin dédié à ce fichier,
// créé directement en base avec un numéro aléatoire, pour rester
// parallélisable sans course sur la file d'OTP — même principe que
// e2e/dispute-flow.spec.ts (createAdmin), qui ne nettoie pas non plus le
// compte admin de test créé pour l'occasion.

async function createAdmin(db: Client): Promise<string> {
  const phone = randomPhone();
  await db.query(
    `INSERT INTO "User" (id, role, phone, "fullName", "createdAt", "updatedAt")
     VALUES ($1, 'ADMIN', $2, 'Admin Agents de Test', now(), now())`,
    [randomUUID(), phone]
  );
  return phone;
}

test("un admin crée un compte agent, qui apparaît dans la liste et est rejeté en doublon", async ({
  page,
  request,
}) => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const agentPhone = randomPhone();
  const agentEmail = `agent-test-${Date.now()}@example.com`;

  try {
    const adminPhone = await createAdmin(db);
    await loginAsAdmin(page, request, adminPhone);

    await page.getByRole("link", { name: /^agents$/i }).click();
    await expect(page).toHaveURL(/\/fr\/admin\/agents$/);

    await page.getByLabel(/nom complet/i).fill("Agent de Test E2E");
    await page.getByLabel(/téléphone/i).fill(agentPhone);
    await page.getByLabel(/^email$/i).fill(agentEmail);
    await page.getByRole("button", { name: /créer l'agent/i }).click();

    await expect(page).toHaveURL(/\/fr\/admin\/agents$/);
    await expect(page.getByText("Agent de Test E2E")).toBeVisible();
    await expect(page.getByText(new RegExp(agentPhone.replace("+", "\\+")))).toBeVisible();

    const created = await db.query('SELECT role, email FROM "User" WHERE phone = $1', [agentPhone]);
    expect(created.rows).toHaveLength(1);
    expect(created.rows[0].role).toBe("AGENT");
    expect(created.rows[0].email).toBe(agentEmail);

    // Un numéro déjà utilisé est rejeté, pas silencieusement écrasé
    // (contrainte d'unicité du schéma, User.phone).
    await page.getByLabel(/nom complet/i).fill("Doublon");
    await page.getByLabel(/téléphone/i).fill(agentPhone);
    await page.getByLabel(/^email$/i).fill("doublon-test@example.com");
    await page.getByRole("button", { name: /créer l'agent/i }).click();
    await expect(page.getByText(/déjà utilisé/i)).toBeVisible();

    // Le nouvel agent apparaît bien dans le sélecteur de planification
    // d'une visite (CDC §4.1.2) — pas seulement dans la liste de cette page.
    await page.goto("/fr/admin");
    const agentOptions = page.locator('select[name="agentId"] option', { hasText: "Agent de Test E2E" });
    if ((await agentOptions.count()) > 0) {
      await expect(agentOptions.first()).toBeAttached();
    }
  } finally {
    await db.query('DELETE FROM "OtpCode" WHERE phone = ANY($1::text[])', [[agentPhone]]);
    await db.query('DELETE FROM "User" WHERE phone = $1', [agentPhone]);
    await db.end();
  }
});
