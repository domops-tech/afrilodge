import "dotenv/config";
import { Client } from "pg";
import { test, expect } from "@playwright/test";
import {
  AGENT_ID_PHONE,
  randomPhone,
  isoDate,
  loginAsOwner,
  bookAsGuest,
  createVerifiedProperty,
  deleteProperty,
} from "./helpers/fixtures";

// Réservation bout en bout (CDC §6.2, épic 5) : sélection de dates avec
// disponibilité temps réel (5.1), verrouillage du calendrier (5.2),
// identification du voyageur par OTP sans compte (5.3), acceptation par le
// propriétaire (5.4). Le client Prisma généré (ESM pur) ne s'importe pas
// depuis un fichier de test Playwright compilé en CommonJS (voir
// e2e/field-visit.spec.ts) : la vérification passe par `pg` brut.
//
// Un propriétaire et un bien sont créés directement pour ce fichier (voir
// e2e/helpers/fixtures.ts) — numéros de téléphone tirés au hasard : aucune
// collision possible avec les autres fichiers, qui utilisent des numéros
// fixes du jeu de démonstration (même précaution dans
// e2e/owner-space.spec.ts). Le bien créé est supprimé en fin de test :
// e2e/public-search.spec.ts compte les biens vérifiés publiés, et les
// fichiers de test tournent en parallèle sur la même base.

test("un voyageur réserve sans compte, le propriétaire accepte puis refuse une autre demande", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);

  const ownerPhone = randomPhone();

  // Le propriétaire s'inscrit normalement (première connexion, CDC
  // §5.2.16) : c'est la seule partie de la mise en place qui passe par
  // l'interface plutôt que par SQL direct, pour garder un compte réel.
  await loginAsOwner(page, request, ownerPhone, "Propriétaire Réservation");

  const setupDb = new Client({ connectionString: process.env.DATABASE_URL });
  await setupDb.connect();
  let propertyId: string;
  try {
    const owner = await setupDb.query(`SELECT id FROM "User" WHERE phone = $1`, [ownerPhone]);
    const agent = await setupDb.query(`SELECT id FROM "User" WHERE phone = $1`, [AGENT_ID_PHONE]);
    propertyId = await createVerifiedProperty(setupDb, owner.rows[0].id, agent.rows[0].id);
  } finally {
    await setupDb.end();
  }

  try {
    // Première demande : dates acceptées ensuite par le propriétaire.
    const acceptCheckIn = new Date();
    acceptCheckIn.setDate(acceptCheckIn.getDate() + 10);
    const acceptCheckOut = new Date();
    acceptCheckOut.setDate(acceptCheckOut.getDate() + 12);

    const guestPhone = randomPhone();
    const bookingStart = Date.now();
    const bookingId = await bookAsGuest(page, request, {
      propertyId,
      checkIn: isoDate(acceptCheckIn),
      checkOut: isoDate(acceptCheckOut),
      guestPhone,
      guestName: "Voyageur de Test",
    });
    const bookingDurationMs = Date.now() - bookingStart;
    expect(bookingId).toBeTruthy();

    // CDC §11.3 : réservation en moins de 3 minutes sur Android d'entrée de
    // gamme. Le temps mesuré ici est celui d'une exécution automatisée
    // (Playwright ne simule pas la saisie humaine ni la lecture d'un SMS
    // réel) : le seuil est délibérément généreux, c'est un garde-fou contre
    // une régression de performance pathologique du tunnel, pas une mesure
    // d'ergonomie humaine réelle — même principe que la chronométrie du
    // Sprint 1 (voir e2e/field-visit.spec.ts).
    expect(bookingDurationMs).toBeLessThan(45_000);

    await expect(page.getByText(/en attente d'acceptation par le propriétaire/i)).toBeVisible();

    const dbAfterRequest = new Client({ connectionString: process.env.DATABASE_URL });
    await dbAfterRequest.connect();
    try {
      const booking = await dbAfterRequest.query(`SELECT status FROM "Booking" WHERE id = $1`, [bookingId]);
      expect(booking.rows[0].status).toBe("REQUESTED");

      const held = await dbAfterRequest.query(
        `SELECT status FROM "AvailabilityDay" WHERE "propertyId" = $1 AND date >= $2 AND date < $3 ORDER BY date`,
        [propertyId, isoDate(acceptCheckIn), isoDate(acceptCheckOut)]
      );
      expect(held.rows).toHaveLength(2);
      expect(held.rows.every((r) => r.status === "HELD")).toBe(true);
    } finally {
      await dbAfterRequest.end();
    }

    // Second voyageur (numéro distinct), dates distinctes : demande refusée
    // ensuite par le propriétaire.
    const refuseCheckIn = new Date();
    refuseCheckIn.setDate(refuseCheckIn.getDate() + 20);
    const refuseCheckOut = new Date();
    refuseCheckOut.setDate(refuseCheckOut.getDate() + 21);

    const secondGuestPhone = randomPhone();
    const refusedBookingId = await bookAsGuest(page, request, {
      propertyId,
      checkIn: isoDate(refuseCheckIn),
      checkOut: isoDate(refuseCheckOut),
      guestPhone: secondGuestPhone,
      guestName: "Second Voyageur de Test",
    });
    expect(refusedBookingId).toBeTruthy();

    // Le propriétaire se reconnecte (le cookie de session a basculé côté
    // voyageur pendant les réservations ci-dessus) pour traiter les deux
    // demandes.
    await loginAsOwner(page, request, ownerPhone, "Propriétaire Réservation");
    await page.goto(`/fr/proprietaire/biens/${propertyId}`);

    const acceptedCard = page.getByTestId(`booking-${bookingId}`);
    await acceptedCard.getByRole("button", { name: /^accepter$/i }).click();

    const dbAfterAccept = new Client({ connectionString: process.env.DATABASE_URL });
    await dbAfterAccept.connect();
    try {
      // Cette action redirige vers la MÊME URL déjà affichée : signal
      // navigateur non fiable pour une soumission gérée côté client par le
      // routeur RSC de Next.js (voir e2e/owner-space.spec.ts, même
      // contrainte documentée en décision 0009). On interroge la base avec
      // re-tentative.
      await expect(async () => {
        const result = await dbAfterAccept.query(`SELECT status FROM "Booking" WHERE id = $1`, [bookingId]);
        expect(result.rows[0].status).toBe("ACCEPTED");
      }).toPass({ timeout: 20_000 });

      // Le calendrier reste verrouillé (HELD) après acceptation : il ne
      // deviendra BOOKED qu'au paiement (Sprint 6).
      const stillHeld = await dbAfterAccept.query(
        `SELECT status FROM "AvailabilityDay" WHERE "propertyId" = $1 AND date >= $2 AND date < $3`,
        [propertyId, isoDate(acceptCheckIn), isoDate(acceptCheckOut)]
      );
      expect(stillHeld.rows.every((r) => r.status === "HELD")).toBe(true);
    } finally {
      await dbAfterAccept.end();
    }

    await page.goto(`/fr/proprietaire/biens/${propertyId}`);
    const refusedCard = page.getByTestId(`booking-${refusedBookingId}`);
    await refusedCard.getByRole("button", { name: /^refuser$/i }).click();

    const dbAfterRefuse = new Client({ connectionString: process.env.DATABASE_URL });
    await dbAfterRefuse.connect();
    try {
      // Le refus libère immédiatement le calendrier — absence de ligne =
      // OPEN (convention établie au Sprint 3), sans attendre l'expiration
      // du verrou (scripts/expire-booking-holds.ts). Les deux vérifications
      // sont regroupées dans la même re-tentative : `transitionBooking` et
      // la libération du calendrier sont deux écritures séquentielles de la
      // même action serveur, un retry qui ne couvrirait que la première
      // peut retomber dans l'intervalle entre les deux sous charge.
      await expect(async () => {
        const result = await dbAfterRefuse.query(`SELECT status FROM "Booking" WHERE id = $1`, [refusedBookingId]);
        expect(result.rows[0].status).toBe("CANCELLED");

        const released = await dbAfterRefuse.query(
          `SELECT status FROM "AvailabilityDay" WHERE "propertyId" = $1 AND date >= $2 AND date < $3`,
          [propertyId, isoDate(refuseCheckIn), isoDate(refuseCheckOut)]
        );
        expect(released.rows).toHaveLength(0);
      }).toPass({ timeout: 20_000 });
    } finally {
      await dbAfterRefuse.end();
    }
  } finally {
    const cleanupDb = new Client({ connectionString: process.env.DATABASE_URL });
    await cleanupDb.connect();
    try {
      await deleteProperty(cleanupDb, propertyId);
    } finally {
      await cleanupDb.end();
    }
  }
});
