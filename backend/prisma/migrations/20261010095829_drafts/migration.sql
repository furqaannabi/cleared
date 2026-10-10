-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftCheck" (
    "deliverableId" TEXT NOT NULL,
    "run" INTEGER NOT NULL DEFAULT 0,
    "phase" TEXT NOT NULL DEFAULT 'no_draft',
    "draftId" TEXT,
    "checkStartedAt" TIMESTAMP(3),
    "windowOpenedAt" TIMESTAMP(3),
    "windowEndsAt" TIMESTAMP(3),
    "objectedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "shown" BOOLEAN NOT NULL DEFAULT false,
    "fileFailure" JSONB,

    CONSTRAINT "DraftCheck_pkey" PRIMARY KEY ("deliverableId")
);

-- CreateTable
CREATE TABLE "DraftUsage" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "seconds" DOUBLE PRECISION NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "analysed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DraftUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Draft_deliverableId_createdAt_idx" ON "Draft"("deliverableId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DraftUsage_draftId_key" ON "DraftUsage"("draftId");

-- CreateIndex
CREATE INDEX "DraftUsage_creatorId_at_idx" ON "DraftUsage"("creatorId", "at");

-- CreateIndex
CREATE INDEX "DraftUsage_at_idx" ON "DraftUsage"("at");
