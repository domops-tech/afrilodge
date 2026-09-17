# 0018 — Prix réservé, reprise du paiement et renouvellement des mentions

Date : 16 septembre 2026. Statut : adopté.

## Problèmes corrigés

Une demande conservait seulement les dates : son prix était recalculé à
l'acceptation depuis le tarif courant. Une acceptation pouvait être enregistrée
avant un échec du PSP ou de l'insertion du paiement. Une demande de vérification
APPROVED bloquait tout renouvellement, tandis que la mention est unique par bien.
Enfin, la connexion par email utilisait une recherche non unique.

## Décisions

- `Booking.totalAmount` est le total CFA convenu au dépôt de la demande. Il est
  calculé côté serveur dans la transaction de réservation, affiché au voyageur
  et au propriétaire, puis repris tel quel pour l'intention de paiement.
- `acceptBooking` autorise uniquement le propriétaire du bien, une demande non
  expirée et les états REQUESTED/ACCEPTED. Le PSP reçoit `bookingId` comme clé
  d'idempotence. Le simulateur retourne une référence stable. Après cet appel,
  une transaction verrouille la réservation, revalide son état, puis enregistre
  ensemble l'acceptation, l'audit et le paiement. Les doubles appels ne produisent
  qu'un paiement. En cas d'échec, le propriétaire peut réessayer. Les anciens
  ACCEPTED sans paiement disposent aussi du bouton de reprise.
- Un adaptateur PSP réel devra garantir ce contrat d'idempotence. Une intention
  créée chez le PSP mais non enregistrée localement n'est pas un paiement encaissé ;
  la reprise retrouve la même intention. Le simulateur reste en mémoire et n'est
  pas un prestataire de production.
- Une demande de renouvellement est possible dans les 30 jours avant l'échéance,
  après expiration ou après retrait. Elle est sérialisée par verrou sur le bien.
  Une mention encore valide reste publiée pendant l'instruction et en cas de
  refus du renouvellement, jusqu'à son expiration ou un retrait explicite.
- `Verification` reste la mention courante unique. Lors du renouvellement, son
  état précédent complet est archivé dans `AuditLog.metadata.previous`, action
  `verification.renewed`, dans la même transaction que sa mise à jour. Les anciennes
  demandes, visites et preuves restent conservées. Les litiges gardent leur lien
  vers la mention du bien ; l'état historique est consultable dans l'audit.
- L'approbation exige une visite terminée, interdit le parcours ordinaire pour
  une contre-visite et verrouille la demande pour éviter des décisions concurrentes.
  L'expiration planifiée ne peut pas écraser une mention renouvelée depuis la
  sélection de ses candidats.
- L'email est facultatif, normalisé (minuscules et espaces périphériques retirés)
  et unique **par rôle**. Deux rôles distincts peuvent partager une adresse. Une
  contrainte SQL interdit les écritures non normalisées. Les conflits d'inscription
  ou de création d'agent renvoient un message de formulaire.
- Des CHECK SQL imposent les bornes des montants, capacités, coordonnées, dates de
  séjour, dates de mention et tentatives OTP. Les rôles et autres règles entre
  tables restent contrôlés dans l'application, dont le rôle AGENT à la planification.
- Des index couvrent propriétaire, session voyageur, nuits liées à une réservation
  et recherche des verrous expirés. Les CHECK sont dans la migration SQL, Prisma
  ne les exprimant pas dans le modèle déclaratif.

## Migration

Appliquer `npx prisma migrate deploy`, puis `npx prisma generate` avant de lancer
la nouvelle version. La migration est transactionnelle, sans suppression de données.
Elle s'arrête si la normalisation révèle plusieurs emails identiques pour un même
rôle, ou si les données existantes violent les nouvelles contraintes. Corriger les
cas identifiés avant de reprendre la migration ; ne pas réinitialiser la base.
Après un échec enregistré par Prisma, suivre sa procédure de résolution des
migrations échouées avant de relancer `migrate deploy`.

Pour les anciennes réservations, le montant du paiement existant est préservé.
Sans paiement, le prix initial n'est pas récupérable : la migration utilise le
tarif courant multiplié par les nuits. Chaque reprise est tracée par
`booking.price_backfilled`, avec la source et le montant. Aucun paiement existant
n'est modifié.

## Vérification

`npm run test:integration` utilise le PostgreSQL de `DATABASE_URL`, crée un schéma
aléatoire, y rejoue les migrations et détruit uniquement ce schéma en fin de test.
Il ne rejoue pas le seed et ne migre pas `public`. Couverture : conflit d'emails
avant migration, conservation/reconstruction des prix, contraintes SQL, prix figé,
pannes PSP et SQL, doubles acceptations, réparation ACCEPTED sans paiement,
autorisation, expiration, renouvellement concurrent, historique et visite incomplète.
