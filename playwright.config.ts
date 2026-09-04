import { defineConfig, devices } from "@playwright/test";

/**
 * Configuration Playwright (S0-1, étendue en S1 pour l'app terrain). Les
 * autres parcours (CDC §5) arrivent au fil des sprints suivants.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 8 workers (la moitié des CPU logiques rapportées par ce conteneur) se
  // sont montrés trop pour les ressources réellement disponibles en local :
  // plusieurs échecs par contention pure (base de données interrogée avec
  // re-tentative jusqu'à 20s, toujours dépassée) sont apparus une fois la
  // suite passée à une vingtaine de tests, jamais quand le test isolé est
  // rejoué seul. CI garde son parallélisme par défaut, protégé par les
  // deux re-tentatives ci-dessus ; seul le développement local est réduit.
  workers: process.env.CI ? undefined : 4,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "Pixel 7 — Android d'entrée de gamme, réseau lent (CDC §2, §11)",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
