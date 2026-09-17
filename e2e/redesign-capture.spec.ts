import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('captures de la refonte', async ({ browser }) => {
  test.skip(!process.env.UI_CAPTURE, 'Capture explicite uniquement');
  test.setTimeout(120_000);
  const stage = process.env.UI_CAPTURE === 'before' ? 'before' : 'after';
  const directory = `docs/qa/refonte-2026-09-16/${stage}`;
  await mkdir(directory, { recursive: true });
  const records = [];
  for (const width of stage === 'before' ? [390, 1440] : [320, 360, 390, 600, 768, 1024, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'fr-FR', deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/fr/recherche?budget=100000');
    const detail = await page.locator('a[href*="/logements/"]').first().getAttribute('href');
    expect(detail).toBeTruthy();
    const id = detail!.split('/').at(-1)!.split('?')[0];
    for (const [name, path] of [['accueil', '/fr'], ['recherche', '/fr/recherche'], ['fiche', detail!], ['reservation', `/fr/reserver/${id}`], ['reprise', '/fr/reserver'], ['connexion', '/fr/connexion']]) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await page.locator('h1').waitFor();
      await page.screenshot({ path: `${directory}/${name}-${width}.png`, fullPage: true });
      await expect(page.getByRole('main')).toHaveCount(1);
      if (name === 'reservation') {
        const checkIn = new Date();
        checkIn.setDate(checkIn.getDate() + 35);
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + 3);
        const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        await page.locator('#checkIn').fill(dateValue(checkIn));
        await page.locator('#checkOut').fill(dateValue(checkOut));
        await page.getByRole('button', { name: /continuer|poursuivre|suivant/i }).click();
        await expect(page.locator('#fullName')).toBeVisible();
        await page.screenshot({ path: `${directory}/reservation-identite-${width}.png`, fullPage: true });
      }
      const diagnostic = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, viewport: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].map(element => ({ tag: element.tagName, className: typeof element.className === 'string' ? element.className.slice(0, 130) : '', text: element.textContent?.trim().slice(0, 60), left: Math.round(element.getBoundingClientRect().left), right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) })).filter(item => item.right > innerWidth + 1 || item.left < -1).sort((a,b) => b.right-a.right).slice(0, 5) }));
      records.push({ name, width, ...diagnostic });
    }
    await context.close();
  }
  if (stage === 'after') {
    const zoomContext = await browser.newContext({ viewport: { width: 640, height: 900 }, locale: 'fr-FR', deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await zoomContext.newPage();
    for (const [name, path] of [['recherche-zoom-200', '/fr/recherche'], ['reservation-zoom-200', '/fr/reserver']]) {
      await page.goto(path);
      await page.locator('h1').waitFor();
      await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
      const diagnostic = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, viewport: innerWidth, scroll: document.documentElement.scrollWidth, dpr: devicePixelRatio }));
      records.push({ name, displayWidthAt200Percent: 1280, ...diagnostic });
    }
    await zoomContext.close();
  }
  await writeFile(`${directory}/results.json`, JSON.stringify(records, null, 2));
  for (const record of records.filter(item => item.overflow)) console.log(JSON.stringify(record));
  if (stage === 'after') expect(records.filter(item => item.overflow), 'Horizontal overflow must be resolved').toEqual([]);
});
