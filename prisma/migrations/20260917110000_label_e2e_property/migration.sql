BEGIN;
-- The deterministic property in e2e/helpers/fixtures.ts is test content,
-- not an offer. Preserve it for existing local test environments while
-- ensuring the public interface labels it as demonstration data.
UPDATE "Property"
SET "isDemo" = true
WHERE title = 'Bien vérifié de test'
  AND description = 'Logement meublé pour les tests de bout en bout.';
COMMIT;
