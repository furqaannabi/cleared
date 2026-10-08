-- CreateEnum
CREATE TYPE "PayPalCallStatus" AS ENUM ('started', 'settled');

-- CreateTable
CREATE TABLE "DeliverableMoney" (
    "deliverableId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "stage" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "payoutEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliverableMoney_pkey" PRIMARY KEY ("deliverableId")
);

-- CreateTable
CREATE TABLE "PayPalCall" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" "PayPalCallStatus" NOT NULL DEFAULT 'started',
    "reference" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "PayPalCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyRecord" (
    "id" SERIAL NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cause" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "reference" TEXT,
    "details" JSONB,

    CONSTRAINT "MoneyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliverableMoney_stage_idx" ON "DeliverableMoney"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "PayPalCall_requestId_key" ON "PayPalCall"("requestId");

-- CreateIndex
CREATE INDEX "PayPalCall_reference_idx" ON "PayPalCall"("reference");

-- CreateIndex
CREATE INDEX "PayPalCall_status_idx" ON "PayPalCall"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayPalCall_deliverableId_purpose_subjectId_key" ON "PayPalCall"("deliverableId", "purpose", "subjectId");

-- CreateIndex
CREATE INDEX "MoneyRecord_deliverableId_id_idx" ON "MoneyRecord"("deliverableId", "id");

-- AddForeignKey
ALTER TABLE "PayPalCall" ADD CONSTRAINT "PayPalCall_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "DeliverableMoney"("deliverableId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyRecord" ADD CONSTRAINT "MoneyRecord_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "DeliverableMoney"("deliverableId") ON DELETE RESTRICT ON UPDATE CASCADE;
