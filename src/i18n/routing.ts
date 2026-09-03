import { defineRouting } from "next-intl/routing";

/**
 * Deux langues dès le départ, jamais rétro-ajoutées (CDC §2). Le français
 * est la langue par défaut du marché visé (zone BCEAO) ; l'anglais est la
 * seconde langue explicitement demandée.
 */
export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
});

export type AppLocale = (typeof routing.locales)[number];
