import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { test, expect } from "@playwright/test";
import { randomPhone } from "./helpers/fixtures";

// Connexion unifiée téléphone/email (CDC §3) — voir
// src/lib/auth/login-flow.ts. Trois garanties vérifiées ici, trouvées en
// construisant cette unification (15/09) :
//  1. la connexion par email fonctionne de bout en bout pour un compte
//     provisionné, sur la même page que le téléphone ;
//  2. un compte d'un autre rôle n'obtient jamais de session sous le rôle
//     de la page visitée (régression de sécurité préexistante, corrigée
//     ici — voir la note d'en-tête de login-flow.ts) ;
//  3. la déconnexion renvoie vers la page de connexion du rôle qui vient
//     de se déconnecter, pas l'accueil public (voir logout-action.ts).

async function createUser(
  db: Client,
  role: "OWNER" | "AGENT" | "ADMIN",
  email?: string
): Promise<{ id: string; phone: string }> {
  const phone = randomPhone();
  const id = randomUUID();
  await db.query(
    `INSERT INTO "User" (id, role, phone, email, "fullName", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'Utilisateur de Test', now(), now())`,
    [id, role, phone, email ?? null]
  );
  return { id, phone };
}

test.describe("connexion unifiée téléphone/email", () => {
  test("un admin se connecte avec son email", async ({ page, request }) => {
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    const email = `admin-unifiee-${Date.now()}@example.com`;
    try {
      const admin = await createUser(db, "ADMIN", email);

      await page.goto("/fr/admin/connexion");
      await page.getByLabel(/téléphone ou email/i).fill(email);
      await page.getByRole("button", { name: /envoyer le code par email/i }).click();
      await expect(page.getByText(email, { exact: false })).toBeVisible();

      const otpResponse = await request.get(`/api/dev/last-otp?phone=${encodeURIComponent(email)}`);
      const { code } = await otpResponse.json();
      expect(code).toMatch(/^\d{6}$/);

      await page.getByLabel(/code reçu par email/i).fill(code);
      await page.getByRole("button", { name: /vérifier/i }).click();
      await expect(page).toHaveURL(/\/fr\/admin$/);

      const sessionCheck = await db.query('SELECT role FROM "User" WHERE id = $1', [admin.id]);
      expect(sessionCheck.rows[0].role).toBe("ADMIN");
    } finally {
      await db.query('DELETE FROM "OtpCode" WHERE phone = $1', [email]);
      await db.end();
    }
  });

  test("un compte agent ne peut pas ouvrir de session propriétaire via /connexion", async ({ page, request }) => {
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
      const agent = await createUser(db, "AGENT");

      await page.goto("/fr/connexion");
      await page.getByLabel(/téléphone ou email/i).fill(agent.phone);
      await page.getByRole("button", { name: /envoyer le code/i }).click();
      // Aucun code envoyé pour un compte d'un autre rôle : même message
      // générique qu'un numéro totalement inconnu (anti-énumération), pas
      // de transition vers l'étape "code" — voir requestLoginOtp.
      await expect(page.getByText(/aucun compte reconnu/i)).toBeVisible();

      const otpResponse = await request.get(`/api/dev/last-otp?phone=${encodeURIComponent(agent.phone)}`);
      const { code } = await otpResponse.json();
      expect(code).toBeNull();
    } finally {
      await db.end();
    }
  });

  test("la déconnexion renvoie vers la page de connexion du rôle, pas l'accueil public", async ({
    page,
    request,
  }) => {
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
      const agent = await createUser(db, "AGENT");

      await page.goto("/fr/terrain/connexion");
      await page.getByLabel(/téléphone ou email/i).fill(agent.phone);
      await page.getByRole("button", { name: /envoyer le code/i }).click();
      await expect(page.getByText(new RegExp(agent.phone.replace("+", "\\+")))).toBeVisible();

      const otpResponse = await request.get(`/api/dev/last-otp?phone=${encodeURIComponent(agent.phone)}`);
      const { code } = await otpResponse.json();
      await page.getByLabel(/code reçu par sms/i).fill(code);
      await page.getByRole("button", { name: /vérifier/i }).click();
      await expect(page).toHaveURL(/\/fr\/terrain$/);

      await page.getByRole("button", { name: /se déconnecter/i }).click();
      await expect(page).toHaveURL(/\/fr\/terrain\/connexion$/);
    } finally {
      await db.end();
    }
  });
});
