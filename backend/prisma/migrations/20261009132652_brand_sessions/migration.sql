-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "linkId" TEXT,
ALTER COLUMN "creatorId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Session_linkId_idx" ON "Session"("linkId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "InviteLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
