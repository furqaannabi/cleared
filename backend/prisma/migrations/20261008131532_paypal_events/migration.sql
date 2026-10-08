-- CreateEnum
CREATE TYPE "PayPalEventStatus" AS ENUM ('received', 'done');

-- CreateTable
CREATE TABLE "PayPalEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "PayPalEventStatus" NOT NULL DEFAULT 'received',
    "outcome" TEXT,
    "deliverableId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayPalEvent_pkey" PRIMARY KEY ("id")
);
