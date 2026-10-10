-- CreateTable
CREATE TABLE "LiveCheck" (
    "deliverableId" TEXT NOT NULL,
    "running" BOOLEAN NOT NULL DEFAULT false,
    "blockedBy" TEXT,
    "answer" TEXT,
    "notFixable" TEXT,
    "undecided" JSONB,
    "ranAt" TIMESTAMP(3),
    "videoDate" TIMESTAMP(3),
    "runs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LiveCheck_pkey" PRIMARY KEY ("deliverableId")
);

-- CreateTable
CREATE TABLE "LiveCheckItem" (
    "deliverableId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "checkedBy" TEXT NOT NULL,
    "evidence" JSONB,
    "hint" TEXT,

    CONSTRAINT "LiveCheckItem_pkey" PRIMARY KEY ("deliverableId","itemId")
);

-- CreateIndex
CREATE INDEX "LiveCheckItem_deliverableId_position_idx" ON "LiveCheckItem"("deliverableId", "position");
