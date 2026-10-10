-- CreateTable
CREATE TABLE "PostCancel" (
    "deliverableId" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,

    CONSTRAINT "PostCancel_pkey" PRIMARY KEY ("deliverableId")
);
