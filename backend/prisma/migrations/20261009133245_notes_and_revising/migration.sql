-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "revising" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "itemId" TEXT,
    "briefLine" INTEGER,
    "deliverableId" TEXT,
    "text" TEXT NOT NULL,
    "reply" TEXT,
    "version" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_dealId_position_idx" ON "Note"("dealId", "position");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
