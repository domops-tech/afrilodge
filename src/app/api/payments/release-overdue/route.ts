import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { confirmArrivalAndRelease } from "@/lib/payments/release";

/**
 * Libération automatique des fonds si le voyageur n'a pas confirmé son
 * arrivée dans les 24h suivant l'heure d'arrivée prévue — "le premier des
 * deux", décision prise avec vous à la planification du Sprint 6 (CDC
 * §5.1.7, §8.6). `Booking.checkIn` ne porte qu'une date, pas une heure :
 * le délai se compte depuis minuit UTC du jour d'arrivée.
 *
 * Volontairement une route HTTP, pas un script `tsx` sous scripts/ comme
 * expire-verifications.ts / expire-booking-holds.ts : le simulateur de
 * paiement garde son état en mémoire du process (voir décision 0012), un
 * script lancé à part ne le partagerait jamais avec le serveur applicatif
 * en cours d'exécution. À brancher sur un déclencheur HTTP planifié (cron
 * de la plateforme d'hébergement, Vercel Cron ou équivalent), protégé par
 * un secret partagé — l'appelant est un ordonnanceur, pas un utilisateur
 * avec une session.
 *
 * Reprend aussi les libérations restées bloquées (arrivée déjà confirmée,
 * paiement toujours `HELD` — ex. panne transitoire du PSP lors du premier
 * essai), pas seulement les arrivées jamais confirmées :
 * `confirmArrivalAndRelease` est idempotente, la rejouer ne répète que ce
 * qui n'a pas encore abouti (voir src/lib/payments/release.ts).
 */
const OVERDUE_HOURS = 24;

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || !process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const threshold = new Date(Date.now() - OVERDUE_HOURS * 60 * 60 * 1000);

  const overdue = await prisma.booking.findMany({
    where: {
      payment: { status: "HELD" },
      OR: [
        { status: "PAID", arrivalConfirmedAt: null, checkIn: { lte: threshold } },
        { status: "IN_PROGRESS", arrivalConfirmedAt: { not: null } },
      ],
    },
    select: { id: true },
  });

  let releasedCount = 0;
  for (const booking of overdue) {
    try {
      await confirmArrivalAndRelease(booking.id);
      releasedCount += 1;
    } catch (err) {
      console.error(`[release-overdue] échec pour la réservation ${booking.id}`, err);
    }
  }

  return NextResponse.json({ releasedCount });
}
