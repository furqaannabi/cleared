-- CreateTable
CREATE TABLE "Ruling" (
    "deliverableId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ruling_pkey" PRIMARY KEY ("deliverableId")
);
