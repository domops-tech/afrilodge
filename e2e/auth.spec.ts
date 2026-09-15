import { test, expect } from "@playwright/test";

// Connexion propriétaire par téléphone + OTP (CDC §3, §5.2.16). Le code est
// récupéré via la route de secours /api/dev/last-otp (voir sa doc) plutôt
// que par un vrai SMS, tant que le fournisseur n'est pas choisi.
test("un nouveau propriétaire se connecte par téléphone + code à usage unique", async ({
  page,
  request,
}) => {
  const phone = `+225070000${Math.floor(1000 + Math.random() * 8999)}`;

  await page.goto("/fr/connexion");
  await page.getByLabel(/téléphone ou email/i).fill(phone);
  await page.getByRole("button", { name: /envoyer le code/i }).click();

  await expect(page.getByText(new RegExp(phone.replace("+", "\\+")))).toBeVisible();

  const otpResponse = await request.get(`/api/dev/last-otp?phone=${encodeURIComponent(phone)}`);
  const { code } = await otpResponse.json();
  expect(code).toMatch(/^\d{6}$/);

  await page.getByLabel(/nom complet/i).fill("Voyageur de Test");
  await page.getByLabel(/code reçu par sms/i).fill(code);
  await page.getByRole("button", { name: /vérifier/i }).click();

  await expect(page).toHaveURL(/\/fr\/proprietaire$/);
  await expect(page.getByRole("heading", { name: /bonjour, voyageur de test/i })).toBeVisible();
});
