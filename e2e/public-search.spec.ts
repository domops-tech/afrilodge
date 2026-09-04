import { test, expect } from "@playwright/test";

// Recherche et fiche détaillée publiques (CDC §6.1). Le jeu de seed publie
// trois biens vérifiés : « Studio meublé, Cocody Angré » et « Deux pièces
// climatisé, Cocody Riviera » (propriétaire Fatou Diabaté), et
// « Appartement meublé, Marcory Résidentiel » (Kouassi Yao).

test.describe("recherche publique (CDC §6.1.1, §6.1.2)", () => {
  test("liste les biens vérifiés, avec des photos qui se chargent réellement", async ({ page }) => {
    await page.goto("/fr/recherche");

    // Au moins les 3 biens vérifiés du seed — pas un total exact : ce
    // fichier tourne en parallèle avec d'autres qui créent ponctuellement
    // un bien publié pour la durée de leur propre test (voir
    // e2e/booking-flow.spec.ts), et un total figé serait fragile face à ça
    // sans rien vérifier de plus sur la recherche elle-même.
    const resultsText = await page.getByText(/logements? vérifiés? trouvés?/).textContent();
    expect(Number(resultsText?.match(/\d+/)?.[0])).toBeGreaterThanOrEqual(3);

    const firstCard = page.getByRole("link", { name: /cocody angré/i });
    await expect(firstCard).toBeVisible();
    await expect(firstCard.getByText("Vérifié")).toBeVisible();

    const thumbnail = firstCard.getByRole("img");
    await expect(async () => {
      expect(await thumbnail.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    }).toPass({ timeout: 20_000 });
  });

  test("filtre par quartier", async ({ page }) => {
    await page.goto("/fr/recherche");
    await page.getByLabel(/quartier/i).fill("Angré");
    await page.getByRole("button", { name: /^rechercher$/i }).click();

    await expect(page).toHaveURL(/quartier=Angr/);
    await expect(page.getByText(/1 logement vérifié trouvé/)).toBeVisible();
    await expect(page.getByRole("link", { name: /cocody angré/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /marcory/i })).toHaveCount(0);
  });

  test("filtre par budget maximum", async ({ page }) => {
    await page.goto("/fr/recherche");
    await page.getByLabel(/budget max/i).fill("16000");
    await page.getByRole("button", { name: /^rechercher$/i }).click();

    // Seul le studio Angré (15 000 FCFA) passe sous ce budget.
    await expect(page.getByText(/1 logement vérifié trouvé/)).toBeVisible();
    await expect(page.getByRole("link", { name: /cocody angré/i })).toBeVisible();
  });
});

test.describe("fiche détaillée (CDC §6.1.3, §6.1.4, §6.1.5)", () => {
  test("affiche la date de vérification, l'agent, les équipements constatés et masque le contact du propriétaire", async ({
    page,
  }) => {
    await page.goto("/fr/recherche");
    await page.getByRole("link", { name: /cocody angré/i }).click();
    await expect(page).toHaveURL(/\/fr\/logements\/.+/);

    // CDC §6.1.3 : date de vérification et agent toujours affichés.
    await expect(page.getByText(/Visité le/)).toBeVisible();
    await expect(page.getByText(/Vérifié par Aïssata Koné/)).toBeVisible();

    // Équipements constatés par la visite (tous confirmés pour ce bien).
    await expect(page.getByText("Wifi")).toBeVisible();

    // Carte de situation approximative (CDC §6.1.4).
    await expect(page.locator('iframe[title="Situation approximative"]')).toBeVisible();

    // CDC §6.1.5 : coordonnées exactes et contact du propriétaire jamais
    // exposés avant confirmation — le numéro de la propriétaire (Fatou
    // Diabaté) ne doit apparaître nulle part sur la page.
    await expect(page.getByText("+2250700000020")).toHaveCount(0);

    // CTA vers la réservation (Sprint 5).
    await page.getByRole("link", { name: /réserver/i }).click();
    await expect(page).toHaveURL(/\/fr\/reserver\/.+/);
  });

  test("une fiche non publiée ou inexistante renvoie 404", async ({ page }) => {
    const response = await page.goto("/fr/logements/inexistant");
    expect(response?.status()).toBe(404);
  });
});
