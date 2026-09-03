/**
 * Jeu de démonstration (S0-3) : 3 propriétaires, 5 biens, 2 agents, 1 admin,
 * un quartier avec plusieurs biens vérifiés et un en attente. Le CDC ne fixe
 * pas de ville précise au-delà de la zone BCEAO ; Abidjan est utilisée ici
 * comme ville de démonstration, à ajuster si VD Technologies vise une autre
 * place.
 *
 * Exécution : npx prisma db seed (ou `npm run db:seed`).
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
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
      verified: true,
    },
    {
      owner: owner1,
      title: "Deux pièces climatisé, Cocody Riviera",
      neighborhood: "Riviera",
      city: "Abidjan",
      price: 22000,
      guests: 3,
      verified: true,
    },
    {
      owner: owner2,
      title: "Appartement meublé, Marcory Résidentiel",
      neighborhood: "Marcory",
      city: "Abidjan",
      price: 18000,
      guests: 4,
      verified: true,
    },
    {
      owner: owner2,
      title: "Studio cosy, Plateau",
      neighborhood: "Plateau",
      city: "Abidjan",
      price: 20000,
      guests: 2,
      verified: false, // en attente de vérification
    },
    {
      owner: owner3,
      title: "Villa meublée, Bingerville",
      neighborhood: "Bingerville",
      city: "Abidjan",
      price: 35000,
      guests: 6,
      verified: false, // brouillon, aucune demande de vérification encore
    },
  ];

  const amenityNames = ["Wifi", "Climatisation", "Eau chaude", "Cuisine équipée", "Générateur"];

  for (const p of propertiesData) {
    const property = await prisma.property.create({
      data: {
        title: p.title,
        description: `${p.title} — logement meublé, à deux pas des commerces du quartier ${p.neighborhood}.`,
        pricePerNight: p.price,
        maxGuests: p.guests,
        neighborhood: p.neighborhood,
        city: p.city,
        accessLandmarks: `Repère : à 200 m de la pharmacie principale de ${p.neighborhood}.`,
        status: p.verified ? "PUBLISHED" : "DRAFT",
        ownerId: p.owner.id,
        amenities: {
          create: amenityNames.map((name) => ({
            name,
            confirmed: p.verified ? true : null,
          })),
        },
      },
    });

    if (p.verified) {
      const request = await prisma.verificationRequest.create({
        data: {
          propertyId: property.id,
          ownerId: p.owner.id,
          status: "APPROVED",
          packPaid: true,
        },
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
    } else if (p.title.includes("Plateau")) {
      // Demande en cours, pas encore visitée.
      await prisma.verificationRequest.create({
        data: {
          propertyId: property.id,
          ownerId: p.owner.id,
          status: "SCHEDULED",
          packPaid: true,
        },
      });
    }
  }

  console.log("Affectation d'une visite en attente pour l'agent 2…");
  const draftRequest = await prisma.verificationRequest.findFirst({
    where: { status: "SCHEDULED" },
  });
  if (draftRequest) {
    await prisma.visit.create({
      data: {
        verificationRequestId: draftRequest.id,
        agentId: agent2.id,
        scheduledAt: daysFromNow(2),
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
