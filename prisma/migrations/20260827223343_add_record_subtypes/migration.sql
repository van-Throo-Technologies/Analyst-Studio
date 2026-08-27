-- AlterTable
ALTER TABLE "requirement" ADD COLUMN     "parentRequirementId" TEXT,
ADD COLUMN     "recordType" TEXT NOT NULL DEFAULT 'feature';

-- AddForeignKey
ALTER TABLE "requirement" ADD CONSTRAINT "requirement_parentRequirementId_fkey" FOREIGN KEY ("parentRequirementId") REFERENCES "requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
