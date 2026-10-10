-- AlterTable
ALTER TABLE "InviteLink" ADD COLUMN     "reason" TEXT;

-- CreateTable
CREATE TABLE "BrandNotice" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "sentTo" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "BrandNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandNotice_deliverableId_kind_key" ON "BrandNotice"("deliverableId", "kind");
