import { test, expect } from "@playwright/test";

test.describe("accueil et internationalisation (CDC §2)", () => {
  // Locale explicite : next-intl négocie normalement la langue du
  // navigateur (Accept-Language) avant de retomber sur le français par
  // défaut — comportement voulu, pas une valeur à figer côté serveur.
  test.use({ locale: "fr-FR" });

  test("redirige vers la langue par défaut (fr) et affiche l'accroche", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/fr$/);
    await expect(
      page.getByRole("heading", { name: /logement meublé, vérifié sur place/i })
    ).toBeVisible();
  });

  test("bascule vers l'anglais depuis le sélecteur de langue", async ({ page }) => {
    await page.goto("/fr");
    await page.getByLabel("Langue").selectOption("en");
    await expect(page).toHaveURL(/\/en$/);
    await expect(
      page.getByRole("heading", { name: /furnished home, verified on site/i })
    ).toBeVisible();
  });
});
