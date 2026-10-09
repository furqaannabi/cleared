-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "brandEmail" TEXT,
ADD COLUMN     "timezone" TEXT;

-- AlterTable
ALTER TABLE "Deliverable" ADD COLUMN     "amountCents" INTEGER,
ADD COLUMN     "deadlineDays" INTEGER;

-- CreateTable
CREATE TABLE "InviteLink" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "turnedOffAt" TIMESTAMP(3),

    CONSTRAINT "InviteLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsVersion" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "terms" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermsVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InviteLink_tokenHash_key" ON "InviteLink"("tokenHash");

-- CreateIndex
CREATE INDEX "InviteLink_dealId_createdAt_idx" ON "InviteLink"("dealId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TermsVersion_dealId_number_key" ON "TermsVersion"("dealId", "number");

-- AddForeignKey
ALTER TABLE "InviteLink" ADD CONSTRAINT "InviteLink_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsVersion" ADD CONSTRAINT "TermsVersion_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
