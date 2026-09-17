BEGIN;
-- Abort rather than choosing a login account or deleting existing data.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE NULLIF(btrim(email), '') IS NOT NULL
    GROUP BY role, lower(btrim(email)) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate normalized User emails within a role. Resolve these accounts before retrying the migration.';
  END IF;
END $$;
UPDATE "User" SET email = NULLIF(lower(btrim(email)), '');
CREATE UNIQUE INDEX "User_role_email_key" ON "User"(role, email);
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized" CHECK (email IS NULL OR (email = lower(btrim(email)) AND email <> ''));

ALTER TABLE "Booking" ADD COLUMN "totalAmount" INTEGER;
-- Existing PSP amounts are authoritative. Before an intent, the historical
-- requested price cannot be recovered: use the current price and record it.
UPDATE "Booking" b SET "totalAmount" = COALESCE(
  (SELECT p.amount FROM "Payment" p WHERE p."bookingId" = b.id),
  (b."checkOut" - b."checkIn") * p."pricePerNight"
) FROM "Property" p WHERE p.id = b."propertyId";
INSERT INTO "AuditLog" (id, action, entity, "entityId", metadata, "createdAt", "bookingId")
SELECT 'price-backfill-' || b.id, 'booking.price_backfilled', 'Booking', b.id,
  jsonb_build_object('totalAmount', b."totalAmount", 'source',
    CASE WHEN EXISTS (SELECT 1 FROM "Payment" p WHERE p."bookingId" = b.id)
      THEN 'existing_payment' ELSE 'current_property_price' END), now(), b.id
FROM "Booking" b;
ALTER TABLE "Booking" ALTER COLUMN "totalAmount" SET NOT NULL;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_valid_stay" CHECK ("checkOut" > "checkIn" AND guests > 0 AND "totalAmount" > 0);
ALTER TABLE "Property" ADD CONSTRAINT "Property_positive_price_capacity" CHECK ("pricePerNight" > 0 AND "maxGuests" > 0);
ALTER TABLE "Property" ADD CONSTRAINT "Property_coordinates" CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_valid_amounts" CHECK (amount > 0 AND ("commissionAmount" IS NULL OR "commissionAmount" BETWEEN 0 AND amount));
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_valid_amount_rate" CHECK (amount >= 0 AND rate BETWEEN 0 AND 1);
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_valid_dates" CHECK ("expiresAt" > "visitDate");
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_nonnegative_attempts" CHECK (attempts >= 0);

CREATE INDEX "Property_ownerId_idx" ON "Property"("ownerId");
CREATE INDEX "Booking_guestSessionId_idx" ON "Booking"("guestSessionId");
CREATE INDEX "AvailabilityDay_bookingId_idx" ON "AvailabilityDay"("bookingId");
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"(status, "holdExpiresAt");
COMMIT;
