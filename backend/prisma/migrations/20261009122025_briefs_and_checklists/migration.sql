-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "briefLines" JSONB;

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "briefLine" INTEGER,
    "addedByCreator" BOOLEAN NOT NULL DEFAULT false,
    "exact" TEXT,
    "checkedBy" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "briefLine" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "suggestions" JSONB NOT NULL,
    "answerKind" TEXT,
    "answerText" TEXT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefRead" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "modelCalled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BriefRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistItem_dealId_position_idx" ON "ChecklistItem"("dealId", "position");

-- CreateIndex
CREATE INDEX "Question_dealId_position_idx" ON "Question"("dealId", "position");

-- CreateIndex
CREATE INDEX "BriefRead_creatorId_at_idx" ON "BriefRead"("creatorId", "at");

-- CreateIndex
CREATE INDEX "BriefRead_at_idx" ON "BriefRead"("at");

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "Deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
