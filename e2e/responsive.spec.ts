import { test, expect } from '@playwright/test';

for (const width of [360, 1440]) {
  test(`affichage public à ${width}px : contenu et réservation accessibles`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'fr-FR', colorScheme: 'light' });
    try {
      const page = await context.newPage();
      await page.goto('/fr/recherche?budget=100000');
      const property = await page.locator('a[href*="/logements/"]').first().getAttribute('href');
      expect(property).toBeTruthy();
      for (const [name, path] of [['accueil', '/fr'], ['recherche', '/fr/recherche'], ['fiche', property!], ['reprise', '/fr/reserver']]) {
        await page.goto(path);
        await expect(page.getByRole('main')).toHaveCount(1);
        await expect(page.locator('a button')).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (name === 'fiche') {
          const cta = page.getByRole('link', { name: /^réserver$/i });
          await expect(cta).toHaveCount(1);
          const box = await cta.boundingBox();
          expect(box!.y + box!.height).toBeLessThan(900);
          const images = page.getByRole('img');
          await expect(async () => {
            for (const img of await images.all()) expect(await img.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
          }).toPass();
        }
        await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true });
      }
    } finally { await context.close(); }
  });
}
