-- CreateTable
CREATE TABLE "RuleBase" (
    "id" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quote" TEXT,
    "sourceDocument" TEXT,
    "tags" TEXT[],
    "regulatoryFrameworks" TEXT[],
    "industry" TEXT NOT NULL,
    "parentRuleId" TEXT,
    "confidence" DOUBLE PRECISION,
    "isGrounded" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleBase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RuleBase_industry_idx" ON "RuleBase"("industry");

-- CreateIndex
CREATE INDEX "RuleBase_recordType_idx" ON "RuleBase"("recordType");

-- CreateIndex
CREATE INDEX "RuleBase_tags_idx" ON "RuleBase"("tags");

-- CreateIndex
CREATE INDEX "RuleBase_regulatoryFrameworks_idx" ON "RuleBase"("regulatoryFrameworks");

-- AddForeignKey
ALTER TABLE "RuleBase" ADD CONSTRAINT "RuleBase_parentRuleId_fkey" FOREIGN KEY ("parentRuleId") REFERENCES "RuleBase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

