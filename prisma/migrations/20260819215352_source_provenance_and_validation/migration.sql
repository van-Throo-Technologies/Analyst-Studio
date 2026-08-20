-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SourceDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'other',
    "content" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "uploaderRole" TEXT,
    "sourceProvenance" TEXT NOT NULL DEFAULT 'manual_transcription',
    "sourceTimestamp" DATETIME,
    "checksumHash" TEXT,
    "validationStatus" TEXT NOT NULL DEFAULT 'pending',
    "validatedByUserId" TEXT,
    "validatedAt" DATETIME,
    "validationNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourceDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SourceDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SourceDocument_validatedByUserId_fkey" FOREIGN KEY ("validatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SourceDocument" ("content", "createdAt", "id", "projectId", "sourceType", "title", "updatedAt", "uploadedByUserId", "uploaderRole") SELECT "content", "createdAt", "id", "projectId", "sourceType", "title", "updatedAt", "uploadedByUserId", "uploaderRole" FROM "SourceDocument";
DROP TABLE "SourceDocument";
ALTER TABLE "new_SourceDocument" RENAME TO "SourceDocument";
CREATE INDEX "SourceDocument_projectId_idx" ON "SourceDocument"("projectId");
CREATE INDEX "SourceDocument_projectId_validationStatus_idx" ON "SourceDocument"("projectId", "validationStatus");
CREATE INDEX "SourceDocument_projectId_checksumHash_idx" ON "SourceDocument"("projectId", "checksumHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
