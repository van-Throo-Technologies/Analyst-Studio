-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "job" TEXT NOT NULL DEFAULT 'quality_review',
    "severity" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "suggestedFix" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiFinding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AiFinding" ("createdAt", "entityId", "entityType", "explanation", "id", "projectId", "runId", "severity", "status", "suggestedFix", "title") SELECT "createdAt", "entityId", "entityType", "explanation", "id", "projectId", "runId", "severity", "status", "suggestedFix", "title" FROM "AiFinding";
DROP TABLE "AiFinding";
ALTER TABLE "new_AiFinding" RENAME TO "AiFinding";
CREATE INDEX "AiFinding_projectId_createdAt_idx" ON "AiFinding"("projectId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
