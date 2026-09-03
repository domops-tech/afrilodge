# Definition of Done

Une story n'est marquée terminée que si **tous** les points suivants sont vrais.
Cette liste elle-même évolue si l'équipe l'ajuste en rétrospective — toute
modification est actée ici, pas seulement dans la mémoire du sprint.

1. **Tests automatisés verts.** `npm test` (Vitest) et, si la story touche un
   parcours utilisateur, `npm run test:e2e` (Playwright). Une règle métier
   nouvelle (calcul, transition d'état, validation) a un test unitaire dédié.
2. **i18n complète.** Aucune chaîne d'interface en dur : tout passe par
   `messages/fr.json` et `messages/en.json`, les deux mis à jour ensemble.
   Un test CI (à ajouter en S1) échoue si une clé manque dans une langue.
3. **Budget de poids respecté** pour toute page publique ou tunnel de
   réservation touché (CDC §2, §11.3) : voir le contrôle Lighthouse CI mis en
   place au Sprint 3.
4. **Vérifié sur mobile bas de gamme / réseau lent.** Au minimum le projet
   Playwright « Pixel 7 » de `playwright.config.ts` ; le testing manuel en
   émulation réseau dégradé est demandé pour tout parcours voyageur.
5. **Pas de fuite de donnée hors périmètre.** Coordonnées d'accès et contact
   du propriétaire jamais exposés avant confirmation (CDC §6.1) ; aucune
   donnée personnelle envoyée à un tiers non prévu par le CDC §10.2.
6. **Autorisation vérifiée côté serveur**, pas seulement côté proxy — voir
   `src/lib/auth/guard.ts` et la note dans `src/proxy.ts`. Toute nouvelle
   route protégée appelle `requireRole`/`requireGuestSession`.
7. **Documentation de la story à jour** : le backlog reflète le statut réel,
   toute décision d'architecture nouvelle a sa fiche dans
   `docs/agile/decisions/`.
8. **Revue de code** (même solo en v1 : relecture à froid du diff) avant de
   marquer la story terminée.

## Rituels

- **Planification** en début de sprint : le chef de projet propose le
  contenu à partir du backlog, arbitré avec vous si le périmètre est ambigu.
- **Revue** en fin de sprint : démonstration réelle (`npm run dev`, jeu de
  données de démonstration, parcours joué en direct), pas une liste de
  tickets fermés.
- **Rétrospective** courte, consignée dans `docs/agile/sprints/sprint-NN.md` :
  ce qui a bien marché, ce qui a coincé, un ajustement concret pour le sprint
  suivant.
