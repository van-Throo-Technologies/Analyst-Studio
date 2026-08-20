-- CreateTable
CREATE TABLE "DomainProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "subdomain" TEXT,
    "jurisdiction" TEXT,
    "regulatorySensitivity" TEXT NOT NULL,
    "solutionDomain" TEXT,
    "terminologyHintsJson" TEXT NOT NULL DEFAULT '[]',
    "likelyRiskAreasJson" TEXT NOT NULL DEFAULT '[]',
    "likelyRequirementThemesJson" TEXT NOT NULL DEFAULT '[]',
    "likelyComplianceConcernsJson" TEXT NOT NULL DEFAULT '[]',
    "promptContextSummary" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DomainProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL DEFAULT 'local',
    "changesSummary" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectAuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "analysisGoal" TEXT NOT NULL DEFAULT '',
    "industry" TEXT NOT NULL DEFAULT 'other',
    "subdomain" TEXT,
    "jurisdiction" TEXT,
    "regulatorySensitivity" TEXT NOT NULL DEFAULT 'low',
    "solutionDomain" TEXT,
    "domainContext" TEXT NOT NULL DEFAULT '',
    "defaultMode" TEXT NOT NULL DEFAULT 'BA',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Project" ("analysisGoal", "createdAt", "defaultMode", "description", "domainContext", "id", "name", "status", "updatedAt") SELECT "analysisGoal", "createdAt", "defaultMode", "description", "domainContext", "id", "name", "status", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DomainProfile_projectId_key" ON "DomainProfile"("projectId");

-- CreateIndex
CREATE INDEX "DomainProfile_projectId_idx" ON "DomainProfile"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_projectId_createdAt_idx" ON "ProjectAuditLog"("projectId", "createdAt");
