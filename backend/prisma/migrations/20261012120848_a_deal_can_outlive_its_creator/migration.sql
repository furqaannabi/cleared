-- DropForeignKey
ALTER TABLE "Deal" DROP CONSTRAINT "Deal_creatorId_fkey";

-- AlterTable
ALTER TABLE "Deal" ALTER COLUMN "creatorId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
