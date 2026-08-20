-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProjectAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "scenarioType" TEXT NOT NULL DEFAULT 'greenfield',
    "ownerId" TEXT,
    "defaultMode" TEXT NOT NULL DEFAULT 'BA',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("analysisGoal", "createdAt", "defaultMode", "description", "domainContext", "id", "industry", "jurisdiction", "name", "regulatorySensitivity", "solutionDomain", "status", "subdomain", "updatedAt") SELECT "analysisGoal", "createdAt", "defaultMode", "description", "domainContext", "id", "industry", "jurisdiction", "name", "regulatorySensitivity", "solutionDomain", "status", "subdomain", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE TABLE "new_ProjectAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'project',
    "entityId" TEXT,
    "changesJson" TEXT NOT NULL DEFAULT '[]',
    "changesSummary" TEXT NOT NULL DEFAULT '',
    "changedBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectAuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProjectAuditLog" ("action", "changedBy", "changesSummary", "createdAt", "id", "projectId") SELECT "action", "changedBy", "changesSummary", "createdAt", "id", "projectId" FROM "ProjectAuditLog";
DROP TABLE "ProjectAuditLog";
ALTER TABLE "new_ProjectAuditLog" RENAME TO "ProjectAuditLog";
CREATE INDEX "ProjectAuditLog_projectId_createdAt_idx" ON "ProjectAuditLog"("projectId", "createdAt");
CREATE INDEX "ProjectAuditLog_userId_idx" ON "ProjectAuditLog"("userId");
CREATE TABLE "new_SourceDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'other',
    "content" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "uploaderRole" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SourceDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SourceDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SourceDocument" ("content", "createdAt", "id", "projectId", "sourceType", "title", "updatedAt") SELECT "content", "createdAt", "id", "projectId", "sourceType", "title", "updatedAt" FROM "SourceDocument";
DROP TABLE "SourceDocument";
ALTER TABLE "new_SourceDocument" RENAME TO "SourceDocument";
CREATE INDEX "SourceDocument_projectId_idx" ON "SourceDocument"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ProjectAccess_userId_idx" ON "ProjectAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAccess_projectId_userId_key" ON "ProjectAccess"("projectId", "userId");
