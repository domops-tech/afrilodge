# Diagrammes d'états

## Réservation (`Booking.status`)

Table de transitions de `src/lib/booking/state-machine.ts` (CDC §7.2). Toute transition est journalisée dans `AuditLog` (`booking.transition`).

```mermaid
stateDiagram-v2
  [*] --> REQUESTED : demande du voyageur

  REQUESTED --> ACCEPTED : le propriétaire accepte
  REQUESTED --> CANCELLED : refus / verrou expiré

  ACCEPTED --> PAID : webhook funds.held
  ACCEPTED --> CANCELLED : annulation / verrou expiré

  PAID --> IN_PROGRESS : arrivée confirmée (ou 24 h écoulées)
  PAID --> CANCELLED : annulation + remboursement
  PAID --> DISPUTED : écart signalé

  IN_PROGRESS --> COMPLETED : séjour terminé
  IN_PROGRESS --> DISPUTED : écart signalé

  DISPUTED --> PAID
  DISPUTED --> IN_PROGRESS
  DISPUTED --> COMPLETED
  DISPUTED --> CANCELLED

  COMPLETED --> DISPUTED : écart signalé a posteriori
  CANCELLED --> [*]
```

## Paiement (`Payment.status`)

L'état ne change que sur webhook vérifié, jamais sur la foi d'un appel sortant.

```mermaid
stateDiagram-v2
  [*] --> INTENT_CREATED : acceptation de la demande
  INTENT_CREATED --> HELD : webhook funds.held
  INTENT_CREATED --> FAILED : échec du paiement
  HELD --> RELEASED : webhook funds.released
  HELD --> REFUNDED : webhook refund.executed
  RELEASED --> [*]
  REFUNDED --> [*]
  FAILED --> [*]
```

## Disponibilité (`AvailabilityDay.status`)

```mermaid
stateDiagram-v2
  [*] --> OPEN : absence de ligne = OPEN
  OPEN --> HELD : demande de réservation
  HELD --> BOOKED : paiement confirmé
  HELD --> OPEN : verrou expiré / refus
  BOOKED --> OPEN : remboursement
  OPEN --> BLOCKED : blocage propriétaire
  BLOCKED --> OPEN : déblocage
```

## Bien (`Property.status`)

```mermaid
stateDiagram-v2
  [*] --> DRAFT : création par le propriétaire
  DRAFT --> PENDING_VERIFICATION : demande de vérification
  PENDING_VERIFICATION --> PUBLISHED : fiche validée par l'admin
  PENDING_VERIFICATION --> DRAFT : fiche refusée
  PUBLISHED --> UNPUBLISHED : mention expirée ou retirée
  UNPUBLISHED --> PENDING_VERIFICATION : renouvellement / nouvelle visite
```

## Demande de vérification (`VerificationRequest.status`)

```mermaid
stateDiagram-v2
  [*] --> REQUESTED : le propriétaire demande
  REQUESTED --> SCHEDULED : admin affecte un agent
  SCHEDULED --> VISITED : visite synchronisée
  VISITED --> APPROVED : admin valide
  VISITED --> REJECTED : admin refuse (motif)
  APPROVED --> [*]
  REJECTED --> [*]
```

## Mention (`Verification.status`) et litige (`Dispute.status`)

```mermaid
stateDiagram-v2
  [*] --> ACTIVE : approbation (valide 12 mois)
  ACTIVE --> EXPIRED : échéance dépassée
  ACTIVE --> WITHDRAWN : contre-visite défavorable
  EXPIRED --> [*]
  WITHDRAWN --> [*]
```

```mermaid
stateDiagram-v2
  [*] --> OPEN : signalement du voyageur
  OPEN --> COUNTER_VISIT_SCHEDULED : contre-visite déclenchée
  OPEN --> RESOLVED_KEPT : résolution directe
  COUNTER_VISIT_SCHEDULED --> RESOLVED_KEPT : mention maintenue
  COUNTER_VISIT_SCHEDULED --> RESOLVED_WITHDRAWN : mention retirée
  RESOLVED_KEPT --> [*]
  RESOLVED_WITHDRAWN --> [*]
```

## Réserves

Les tables `Booking` ci-dessus reprennent le code. Pour les autres machines (bien, demande de vérification, mention, litige), les transitions sont déduites du schéma, du backlog et du README, pas d'une table de transitions dans le code : à confirmer en relisant `src/lib/verification/` avant de les considérer comme normatives. En particulier, je n'ai trouvé aucun appel qui fait passer une réservation `IN_PROGRESS → COMPLETED`.
