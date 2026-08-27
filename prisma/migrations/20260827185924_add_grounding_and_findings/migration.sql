-- AlterTable
ALTER TABLE "project" ADD COLUMN     "coverageScore" INTEGER;

-- AlterTable
ALTER TABLE "requirement" ADD COLUMN     "evidence" TEXT,
ADD COLUMN     "isGrounded" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "project_finding" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "evidence" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_finding_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "project_finding" ADD CONSTRAINT "project_finding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
