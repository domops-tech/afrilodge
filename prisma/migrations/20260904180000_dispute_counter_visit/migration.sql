-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN "counterVisitRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_counterVisitRequestId_key" ON "Dispute"("counterVisitRequestId");

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_counterVisitRequestId_fkey" FOREIGN KEY ("counterVisitRequestId") REFERENCES "VerificationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
