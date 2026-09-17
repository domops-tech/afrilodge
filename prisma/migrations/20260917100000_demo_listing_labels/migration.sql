BEGIN;
ALTER TABLE "Property" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
-- These three owner accounts and their entire catalogue are provisioned by
-- prisma/seed.ts, which contains sample listings with synthetic details.
UPDATE "Property" p SET "isDemo" = true
FROM "User" u WHERE p."ownerId" = u.id AND u.phone IN (
  '+2250700000020', '+2250700000021', '+2250700000022'
);
COMMIT;
