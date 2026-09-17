BEGIN;
ALTER TABLE "VisitPhoto" ADD COLUMN "isDemoPlaceholder" BOOLEAN NOT NULL DEFAULT false;
-- Seed-era fixture imagery is a synthetic colour target shared by every
-- sample home; never render it as photographic evidence of a real property.
UPDATE "VisitPhoto" vp SET "isDemoPlaceholder" = true
FROM "Visit" v
JOIN "VerificationRequest" r ON r.id = v."verificationRequestId"
JOIN "Property" p ON p.id = r."propertyId"
JOIN "User" u ON u.id = p."ownerId"
WHERE vp."visitId" = v.id AND u.phone IN (
  '+2250700000020', '+2250700000021', '+2250700000022'
);
COMMIT;
