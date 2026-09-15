import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { S3Client, PutObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { randomPhone } from "./fixtures";

export async function visitFixture(completed: boolean) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const ownerId = randomUUID(), agentId = randomUUID(), adminId = randomUUID();
  const propertyId = randomUUID(), requestId = randomUUID(), visitId = randomUUID();
  const agentPhone = randomPhone(), adminPhone = randomPhone();
  const title = `Visite QA ${propertyId}`;
  const storage = new S3Client({ endpoint: process.env.STORAGE_ENDPOINT, region: process.env.STORAGE_REGION,
    forcePathStyle: true, credentials: { accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!, secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY! } });
  for (const [id, phone, role] of [[ownerId, randomPhone(), "OWNER"], [agentId, agentPhone, "AGENT"], [adminId, adminPhone, "ADMIN"]]) {
    await db.query('INSERT INTO "User" (id, phone, role, "fullName", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,now(),now())', [id, phone, role, role]);
  }
  await db.query(`INSERT INTO "Property" (id,title,description,"pricePerNight","maxGuests",neighborhood,city,status,"ownerId","createdAt","updatedAt")
    VALUES ($1,$2,'Logement de recette',500000,4,'QA','Abidjan','PENDING_VERIFICATION',$3,now(),now())`, [propertyId,title,ownerId]);
  await db.query(`INSERT INTO "VerificationRequest" (id,status,"propertyId","ownerId","packPaid","createdAt","updatedAt")
    VALUES ($1,$2,$3,$4,true,now(),now())`, [requestId, completed ? "VISITED" : "SCHEDULED", propertyId, ownerId]);
  await db.query(`INSERT INTO "Visit" (id,"scheduledAt","completedAt","checkInAt","verificationRequestId","agentId","createdAt","updatedAt")
    VALUES ($1,now(),$2,$2,$3,$4,now(),now())`, [visitId,completed ? new Date() : null,requestId,agentId]);
  await db.query(`INSERT INTO "PropertyAmenity" (id,"propertyId",name) VALUES ($1,$2,'Climatisation')`, [randomUUID(),propertyId]);
  if (completed) {
    const key = `visits/${visitId}/fixture.jpg`;
    await storage.send(new PutObjectCommand({ Bucket: process.env.STORAGE_BUCKET, Key: key, Body: await readFile('e2e/fixtures/sample.jpg'), ContentType: 'image/jpeg' }));
    await db.query(`INSERT INTO "VisitPhoto" (id,"visitId",slot,"storageKey","takenAt") VALUES ($1,$2,'FACADE',$3,now())`, [randomUUID(),visitId,key]);
    await db.query(`INSERT INTO "AmenityCheck" (id,"visitId","amenityName",announced,observed) VALUES ($1,$2,'Climatisation',true,false)`, [randomUUID(),visitId]);
  }
  return { db, propertyId, requestId, visitId, title, agentPhone, adminPhone, async cleanup() {
    const photos = await db.query('SELECT "storageKey" FROM "VisitPhoto" WHERE "visitId"=$1', [visitId]);
    const identities = await db.query('SELECT "identityDocumentRef", "titleToRentRef" FROM "IdentityCheck" WHERE "visitId"=$1', [visitId]);
    const keys = [...photos.rows.map(r => r.storageKey), ...identities.rows.flatMap(r => [r.identityDocumentRef, r.titleToRentRef])];
    if (keys.length) await storage.send(new DeleteObjectsCommand({ Bucket: process.env.STORAGE_BUCKET, Delete: { Objects: keys.map(Key => ({ Key })) } }));
    await db.query('DELETE FROM "AuditLog" WHERE "actorId" = ANY($1::text[]) OR "entityId" = ANY($2::text[])', [[ownerId, agentId, adminId], [visitId, propertyId, requestId]]);
    await db.query('DELETE FROM "Property" WHERE id=$1', [propertyId]);
    await db.query('DELETE FROM "OtpCode" WHERE phone = ANY($1::text[])', [[agentPhone,adminPhone]]);
    await db.query('DELETE FROM "User" WHERE id = ANY($1::text[])', [[ownerId,agentId,adminId]]);
    await db.end();
  } };
}
