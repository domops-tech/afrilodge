import { test, expect, type Page } from "@playwright/test";

/**
 * Budget de poids (CDC §2, §7.3 : "les photographies représentent
 * l'essentiel du poids des pages ; un budget en kilo-octets par fiche doit
 * être fixé et contrôlé"). Vignette de liste ≤ 30 Ko, premier écran de
 * fiche détaillée ≤ 800 Ko — chiffres du plan de sprint.
 *
 * Choix délibéré : un test Playwright mesurant les octets réellement
 * transférés, plutôt que Lighthouse CI. Même intention (garde-fou de
 * régression en CI), outillage déjà éprouvé dans ce dépôt tout au long des
 * sprints précédents plutôt qu'une nouvelle chaîne d'outils (lancement de
 * Chrome, throttling réseau) plus fragile en environnement conteneurisé —
 * voir docs/agile/decisions/0008. La carte OpenStreetMap (iframe tiers)
 * est délibérément exclue du budget : ce n'est pas un poids que notre
 * pipeline contrôle, au même titre qu'un Lighthouse "resource summary"
 * distingue premier et tiers parti.
 *
 * La fixture `e2e/fixtures/sample.jpg` est une photo réaliste (1600×1067,
 * ~360 Ko source) — une image en aplat de 64×64 ne compresserait à presque
 * rien quelle que soit la taille demandée et rendrait ce budget aveugle à
 * une régression réelle (ce qui a précisément permis de vérifier que le
 * correctif `sizes` de src/components/PropertyImage.tsx, motivé par la
 * décision 0007, tient : sans lui, une vignette peut peser 250+ Ko au lieu
 * de ~5 Ko).
 */

const FIRST_PARTY_HOSTS = ["localhost:3000", "localhost:9000"];

function isFirstParty(url: string): boolean {
  try {
    return FIRST_PARTY_HOSTS.includes(new URL(url).host);
  } catch {
    return false;
  }
}

async function sumFirstPartyBytes(page: Page, url: string): Promise<number> {
  let total = 0;
  page.on("response", (response) => {
    if (!isFirstParty(response.url())) return;
    void response
      .body()
      .then((buf) => {
        total += buf.length;
      })
      .catch(() => {
        // Réponse sans corps exploitable (redirection, 304…) — ignorée.
      });
  });
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  return total;
}

test.describe("budget de poids des pages publiques (CDC §7.3)", () => {
  test("une vignette de la liste de recherche pèse au plus 30 Ko", async ({ page }) => {
    const imageSizes: number[] = [];
    page.on("response", (response) => {
      if (!response.url().includes("/_next/image")) return;
      void response
        .body()
        .then((buf) => imageSizes.push(buf.length))
        .catch(() => {});
    });

    await page.goto("/fr/recherche");
    await page.waitForLoadState("networkidle");

    expect(imageSizes.length).toBeGreaterThan(0);
    for (const size of imageSizes) {
      expect(size).toBeLessThanOrEqual(30 * 1024);
    }
  });

  test("le premier écran d'une fiche détaillée pèse au plus 800 Ko (ressources propres)", async ({
    page,
    context,
  }) => {
    await page.goto("/fr/recherche");
    const href = await page.getByRole("link", { name: /cocody angré/i }).getAttribute("href");
    expect(href).toBeTruthy();

    // Nouvelle page pour mesurer un vrai premier chargement, sans cache
    // hérité de la navigation de recherche.
    const freshPage = await context.newPage();
    const total = await sumFirstPartyBytes(freshPage, href!);
    await freshPage.close();

    expect(total).toBeLessThanOrEqual(800 * 1024);
  });
});
