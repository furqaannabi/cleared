-- AlterTable
ALTER TABLE "DraftCheck" ADD COLUMN     "failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "speechJobId" TEXT,
ADD COLUMN     "stage" TEXT;

-- CreateTable
CREATE TABLE "CheckItem" (
    "deliverableId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "checkedBy" TEXT NOT NULL,
    "evidence" JSONB,
    "hint" TEXT,
    "ask" TEXT NOT NULL DEFAULT 'none',
    "objected" BOOLEAN NOT NULL DEFAULT false,
    "previous" TEXT,
    "whenReplaced" TEXT,

    CONSTRAINT "CheckItem_pkey" PRIMARY KEY ("deliverableId","itemId")
);

-- CreateIndex
CREATE INDEX "CheckItem_deliverableId_position_idx" ON "CheckItem"("deliverableId", "position");
