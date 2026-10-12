-- AlterTable
ALTER TABLE "LiveCheck" ADD COLUMN     "fetchedKey" TEXT,
ADD COLUMN     "fetchedSec" DOUBLE PRECISION,
ADD COLUMN     "readingSince" TIMESTAMP(3),
ADD COLUMN     "speechJobId" TEXT;

-- AlterTable
ALTER TABLE "PostVideo" ADD COLUMN     "link" TEXT,
ADD COLUMN     "postedAt" TIMESTAMP(3),
ADD COLUMN     "shortCode" TEXT;
