# Diagramme de classes — modèle de données

Source de vérité : `prisma/schema.prisma` (20 modèles). Seuls les attributs structurants sont reproduits.

```mermaid
classDiagram
  direction LR

  class User {
    id
    role : OWNER | AGENT | ADMIN
    phone «unique»
    email? «unique par rôle»
    fullName
  }
  class OtpCode {
    phone
    purpose : OtpPurpose
    codeHash
    attempts
    expiresAt
    consumedAt?
  }
  class GuestSession {
    phone
    email?
    fullName
    expiresAt «6 h»
  }

  class Property {
    status : DRAFT | PENDING_VERIFICATION | PUBLISHED | UNPUBLISHED
    title, description
    pricePerNight «FCFA»
    maxGuests
    neighborhood, city
    latitude?, longitude?
    accessLandmarks?
  }
  class PropertyAmenity {
    name
    confirmed? «null = non vérifié»
  }
  class VerificationRequest {
    status : REQUESTED | SCHEDULED | VISITED | APPROVED | REJECTED
    packPaid
    rejectionReason?
  }
  class Visit {
    scheduledAt
    startedAt?, completedAt?
    checkInAt?, checkInLatitude?, checkInLongitude?
    accessLandmarks?
    clientVisitId? «hors connexion»
  }
  class VisitPhoto {
    slot : PhotoSlot
    label?
    storageKey
    takenAt
  }
  class AmenityCheck {
    amenityName
    announced
    observed
    note?
  }
  class IdentityCheck {
    identityDocumentRef
    titleToRentRef
    verifiedByAgent
  }
  class Verification {
    status : ACTIVE | EXPIRED | WITHDRAWN
    visitDate
    expiresAt «+12 mois»
    attestationLabel
    approvedBy?, approvedAt?
    withdrawnAt?, withdrawnReason?
    renewalReminderSentAt?
  }

  class AvailabilityDay {
    date «une ligne par nuit»
    status : OPEN | HELD | BOOKED | BLOCKED
  }
  class Booking {
    status : BookingStatus
    checkIn, checkOut
    guests
    totalAmount «figé à la demande»
    stayCode «unique»
    accessInfo? «null avant paiement»
    arrivalConfirmedAt?
    holdExpiresAt?
  }
  class Payment {
    status : INTENT_CREATED | HELD | RELEASED | REFUNDED | FAILED
    providerName
    providerIntentRef «unique»
    amount
    commissionAmount?
  }
  class PaymentEvent {
    type
    externalId «idempotence»
    payload : Json
    receivedAt
  }
  class CommissionEntry {
    amount
    rate
    settledAt?
  }
  class Dispute {
    status : OPEN | COUNTER_VISIT_SCHEDULED | RESOLVED_KEPT | RESOLVED_WITHDRAWN
    reason
    resolutionNote?
    resolvedAt?
  }

  class AuditLog {
    action
    entity, entityId
    metadata : Json?
  }
  class Notification {
    channel : sms | email
    recipient
    template
    sentAt?
  }
  class PlatformSetting {
    key «id»
    value
  }

  User "1" --> "*" Property : possède (OWNER)
  User "1" --> "*" VerificationRequest : demande (OWNER)
  User "1" --> "*" Visit : réalise (AGENT)
  User "1" --> "*" OtpCode
  User "1" --> "*" AuditLog : acteur

  Property "1" --> "*" PropertyAmenity
  Property "1" --> "*" VerificationRequest
  Property "1" --> "0..1" Verification : mention courante
  Property "1" --> "*" AvailabilityDay
  Property "1" --> "*" Booking
  Property "1" --> "*" Dispute

  VerificationRequest "1" --> "0..1" Visit
  Visit "1" --> "*" VisitPhoto
  Visit "1" --> "*" AmenityCheck
  Visit "1" --> "0..1" IdentityCheck
  Visit "1" --> "0..1" Verification : fonde

  GuestSession "1" --> "*" Booking
  Booking "1" --> "*" AvailabilityDay : verrouille
  Booking "1" --> "0..1" Payment
  Booking "1" --> "0..1" CommissionEntry
  Booking "1" --> "0..1" Dispute
  Booking "1" --> "*" AuditLog
  Payment "1" --> "*" PaymentEvent

  Verification "1" --> "*" Dispute : contestée par
  Dispute "0..1" --> "0..1" VerificationRequest : contre-visite
```

## Invariants portés par le schéma

- `Verification` a une FK obligatoire vers `Visit` et une seule mention courante par bien (`propertyId` unique) ; la complétion de la visite est contrôlée par le flux d'approbation.
- `AvailabilityDay` : unicité `(propertyId, date)` ; l'absence de ligne vaut `OPEN`.
- `Booking.totalAmount` est figé à la demande ; `accessInfo` reste `null` jusqu'au paiement confirmé.
- `PaymentEvent.externalId` unique : un événement PSP n'est traité qu'une fois.
- `User` : `phone` unique, `(role, email)` unique.
- Le voyageur n'a pas de modèle `User` : seulement `GuestSession`.
