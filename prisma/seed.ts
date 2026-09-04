/**
 * Jeu de démonstration (S0-3, étendu en S2) : 3 propriétaires, 6 biens,
 * 2 agents, 1 admin. Trois biens déjà vérifiés et publiés, un en attente de
 * visite, un brouillon, et deux fiches déjà visitées en attente de décision
 * du back-office (une pour démontrer l'approbation, une le refus). Le CDC ne
 * fixe pas de ville précise au-delà de la zone BCEAO ; Abidjan est utilisée
 * ici comme ville de démonstration, à ajuster si VD Technologies vise une
 * autre place.
 *
 * Exécution : npx prisma db seed (ou `npm run db:seed`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildStorageKey, putObjectDirect, ensureBucketExists } from "../src/lib/storage/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SAMPLE_IMAGE = readFileSync(join(__dirname, "..", "e2e", "fixtures", "sample.jpg"));

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/** Envoi direct au stockage objet — voir src/lib/storage/client.ts. */
async function uploadDemoImage(kind: "visit-photo" | "identity-document", visitId: string) {
  const storageKey = buildStorageKey(kind, visitId, "jpg");
  await putObjectDirect(storageKey, SAMPLE_IMAGE, "image/jpeg");
  return storageKey;
}

async function main() {
  console.log("Préparation du stockage objet…");
  await ensureBucketExists();

  console.log("Nettoyage des données existantes…");
  // Ordre inverse des dépendances.
  await prisma.auditLog.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.paymentEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.commissionEntry.deleteMany();
  await prisma.availabilityDay.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.guestSession.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.identityCheck.deleteMany();
  await prisma.amenityCheck.deleteMany();
  await prisma.visitPhoto.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.verificationRequest.deleteMany();
  await prisma.propertyAmenity.deleteMany();
  await prisma.property.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.user.deleteMany();

  console.log("Création des comptes…");
  const admin = await prisma.user.create({
    data: {
      role: "ADMIN",
      phone: "+2250700000001",
      email: "admin@vdtechnologies.example",
      fullName: "Admin VD Technologies",
    },
  });

  const [agent1, agent2] = await Promise.all([
    prisma.user.create({
      data: {
        role: "AGENT",
        phone: "+2250700000010",
        fullName: "Aïssata Koné",
      },
    }),
    prisma.user.create({
      data: {
        role: "AGENT",
        phone: "+2250700000011",
        fullName: "Jean-Marc Assouan",
      },
    }),
  ]);

  const [owner1, owner2, owner3] = await Promise.all([
    prisma.user.create({
      data: { role: "OWNER", phone: "+2250700000020", fullName: "Fatou Diabaté" },
    }),
    prisma.user.create({
      data: { role: "OWNER", phone: "+2250700000021", fullName: "Kouassi Yao" },
    }),
    prisma.user.create({
      data: { role: "OWNER", phone: "+2250700000022", fullName: "Marième Sow" },
    }),
  ]);

  console.log("Création des biens…");
  const propertiesData = [
    {
      owner: owner1,
      title: "Studio meublé, Cocody Angré",
      neighborhood: "Angré",
      city: "Abidjan",
      price: 15000,
      guests: 2,
      status: "verified" as const,
    },
    {
      owner: owner1,
      title: "Deux pièces climatisé, Cocody Riviera",
      neighborhood: "Riviera",
      city: "Abidjan",
      price: 22000,
      guests: 3,
      status: "verified" as const,
    },
    {
      owner: owner2,
      title: "Appartement meublé, Marcory Résidentiel",
      neighborhood: "Marcory",
      city: "Abidjan",
      price: 18000,
      guests: 4,
      status: "verified" as const,
    },
    {
      owner: owner2,
      title: "Studio cosy, Plateau",
      neighborhood: "Plateau",
      city: "Abidjan",
      price: 20000,
      guests: 2,
      status: "scheduled" as const, // visite planifiée, pas encore réalisée — voir e2e/field-visit.spec.ts
    },
    {
      owner: owner3,
      title: "Villa meublée, Bingerville",
      neighborhood: "Bingerville",
      city: "Abidjan",
      price: 35000,
      guests: 6,
      status: "pending_review" as const, // visitée, en attente de décision admin — démonstration de l'approbation
    },
    {
      owner: owner2,
      title: "Chambre meublée, Yopougon",
      neighborhood: "Yopougon",
      city: "Abidjan",
      price: 9000,
      guests: 1,
      status: "pending_review_reject" as const, // visitée, en attente de décision admin — démonstration du refus
    },
  ];

  const amenityNames = ["Wifi", "Climatisation", "Eau chaude", "Cuisine équipée", "Générateur"];
  const photoSlots = ["FACADE", "ENTREE", "SANITAIRES", "CUISINE", "VUE", "ACCES"] as const;

  for (const p of propertiesData) {
    const alreadyPublished = p.status === "verified";
    const property = await prisma.property.create({
      data: {
        title: p.title,
        description: `${p.title} — logement meublé, à deux pas des commerces du quartier ${p.neighborhood}.`,
        pricePerNight: p.price,
        maxGuests: p.guests,
        neighborhood: p.neighborhood,
        city: p.city,
        accessLandmarks: `Repère : à 200 m de la pharmacie principale de ${p.neighborhood}.`,
        status: alreadyPublished ? "PUBLISHED" : "DRAFT",
        ownerId: p.owner.id,
        amenities: {
          create: amenityNames.map((name) => ({
            name,
            confirmed: alreadyPublished ? true : null,
          })),
        },
      },
    });

    if (p.status === "verified") {
      const request = await prisma.verificationRequest.create({
        data: { propertyId: property.id, ownerId: p.owner.id, status: "APPROVED", packPaid: true },
      });
      const visit = await prisma.visit.create({
        data: {
          verificationRequestId: request.id,
          agentId: agent1.id,
          scheduledAt: daysFromNow(-10),
          startedAt: daysFromNow(-10),
          completedAt: daysFromNow(-10),
          checkInAt: daysFromNow(-10),
          checkInLatitude: 5.359952,
          checkInLongitude: -3.996452,
        },
      });
      await prisma.verification.create({
        data: {
          propertyId: property.id,
          visitId: visit.id,
          visitDate: daysFromNow(-10),
          expiresAt: daysFromNow(365 - 10),
          status: "ACTIVE",
          approvedBy: admin.id,
          approvedAt: daysFromNow(-9),
        },
      });
      continue;
    }

    if (p.status === "scheduled") {
      const request = await prisma.verificationRequest.create({
        data: { propertyId: property.id, ownerId: p.owner.id, status: "SCHEDULED", packPaid: true },
      });
      await prisma.visit.create({
        data: { verificationRequestId: request.id, agentId: agent2.id, scheduledAt: daysFromNow(2) },
      });
      continue;
    }

    // pending_review / pending_review_reject : fiche déjà visitée, en
    // attente de décision du back-office (épic 2). Un écart d'équipement
    // délibéré rend la revue admin réaliste.
    const request = await prisma.verificationRequest.create({
      data: { propertyId: property.id, ownerId: p.owner.id, status: "VISITED", packPaid: true },
    });
    const visitedAt = p.status === "pending_review" ? daysFromNow(-1) : daysFromNow(-2);
    const visit = await prisma.visit.create({
      data: {
        verificationRequestId: request.id,
        agentId: agent1.id,
        scheduledAt: visitedAt,
        startedAt: visitedAt,
        completedAt: visitedAt,
        checkInAt: visitedAt,
        checkInLatitude: 5.359952,
        checkInLongitude: -3.996452,
        accessLandmarks: `Repère : à 200 m de la pharmacie principale de ${p.neighborhood}.`,
      },
    });

    for (const slot of photoSlots) {
      const storageKey = await uploadDemoImage("visit-photo", visit.id);
      await prisma.visitPhoto.create({
        data: { visitId: visit.id, slot, storageKey, takenAt: visitedAt },
      });
    }
    const roomStorageKey = await uploadDemoImage("visit-photo", visit.id);
    await prisma.visitPhoto.create({
      data: { visitId: visit.id, slot: "PIECE", label: "Salon", storageKey: roomStorageKey, takenAt: visitedAt },
    });

    await prisma.amenityCheck.createMany({
      data: amenityNames.map((name, i) => ({
        visitId: visit.id,
        amenityName: name,
        announced: true,
        observed: i !== 0, // le premier équipement annoncé est absent — écart visible en revue
      })),
    });

    const identityDocKey = await uploadDemoImage("identity-document", visit.id);
    const titleDocKey = await uploadDemoImage("identity-document", visit.id);
    await prisma.identityCheck.create({
      data: {
        visitId: visit.id,
        identityDocumentRef: identityDocKey,
        titleToRentRef: titleDocKey,
        verifiedByAgent: true,
      },
    });
  }

  console.log("Jeu de démonstration créé :", {
    admin: admin.phone,
    agents: [agent1.phone, agent2.phone],
    owners: [owner1.phone, owner2.phone, owner3.phone],
    properties: propertiesData.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
