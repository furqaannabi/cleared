-- AlterTable
ALTER TABLE "DraftCheck" ADD COLUMN     "reviewOpenedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InviteLink" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "deliverableId" TEXT;
