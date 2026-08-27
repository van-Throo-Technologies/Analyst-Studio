-- AlterTable
ALTER TABLE "requirement" ADD COLUMN     "assumption" TEXT,
ADD COLUMN     "businessRule" TEXT,
ADD COLUMN     "dependency" TEXT,
ADD COLUMN     "packVariant" TEXT NOT NULL DEFAULT 'both',
ADD COLUMN     "precondition" TEXT,
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'in-scope',
ADD COLUMN     "sourceDocumentIds" TEXT,
ADD COLUMN     "validation" TEXT;
