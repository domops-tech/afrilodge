# Diagramme de séquence — réservation, paiement et libération des fonds

Parcours nominal du CDC §6.2, §7.3, §8. Chaque changement de statut de réservation passe par `src/lib/booking/state-machine.ts` ; le statut de paiement ne change que sur webhook vérifié (`src/lib/payments/webhook-handler.ts`).

```mermaid
sequenceDiagram
  autonumber
  actor V as Voyageur
  participant App as Application (Next.js)
  participant DB as PostgreSQL
  participant SMS as Fournisseur SMS/Email
  actor P as Propriétaire
  participant PSP as PSP Mobile Money
  participant Cron as Planificateur

  rect rgb(240, 245, 255)
  Note over V,DB: 1. Demande de réservation
  V->>App: Choisit dates et nombre de voyageurs
  App->>DB: Lit AvailabilityDay (OPEN ?)
  V->>App: Demande à réserver
  App->>SMS: Envoie le code à usage unique
  SMS-->>V: Code OTP
  V->>App: Saisit le code
  App->>DB: Crée GuestSession (6 h)
  App->>DB: Crée Booking REQUESTED (total figé, stayCode)
  App->>DB: AvailabilityDay → HELD + holdExpiresAt
  App-->>V: Demande envoyée au propriétaire
  end

  rect rgb(245, 255, 245)
  Note over P,PSP: 2. Acceptation et intention de paiement
  App-->>P: Notification de nouvelle demande
  P->>App: Accepte la demande
  App->>PSP: createIntent(montant)
  PSP-->>App: providerIntentRef
  App->>DB: Payment INTENT_CREATED
  App->>DB: transitionBooking REQUESTED → ACCEPTED
  App-->>V: Lien de paiement
  end

  rect rgb(255, 250, 235)
  Note over V,PSP: 3. Paiement
  V->>PSP: Paie par Mobile Money
  PSP->>App: Webhook funds.held (signature vérifiée)
  App->>DB: PaymentEvent (externalId unique)
  App->>DB: Payment → HELD
  App->>DB: transitionBooking ACCEPTED → PAID
  App->>DB: AvailabilityDay HELD → BOOKED
  App->>DB: CommissionEntry + accessInfo débloqué
  App-->>V: Confirmation, code de séjour, infos d'accès
  end

  rect rgb(255, 245, 245)
  Note over V,PSP: 4. Arrivée et libération des fonds
  alt Le voyageur confirme son arrivée
    V->>App: Confirme son arrivée
  else Aucune confirmation 24 h après l'arrivée prévue
    Cron->>App: POST /api/payments/release-overdue (x-cron-secret)
  end
  App->>DB: transitionBooking PAID → IN_PROGRESS, arrivalConfirmedAt
  App->>PSP: release(providerIntentRef)
  PSP->>App: Webhook funds.released
  App->>DB: Payment → RELEASED, commission réglée
  end

  opt Pas de paiement avant holdExpiresAt
    Cron->>App: bookings:expire-holds
    App->>DB: transitionBooking → CANCELLED
    App->>DB: AvailabilityDay HELD → OPEN
  end
```

## Points d'attention

- **Idempotence** : un webhook rejoué est ignoré grâce à `PaymentEvent.externalId`.
- **Libération rejouable** : si l'ordre `release()` échoue, l'arrivée reste confirmée et le paiement reste `HELD` ; la route `release-overdue` retente (décision 0012).
- **Annulation avec remboursement** : le webhook `refund.executed` passe le paiement à `REFUNDED`, la réservation à `CANCELLED`, libère les nuits et supprime la commission non réglée.
