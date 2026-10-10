-- CreateTable
CREATE TABLE "PostVideo" (
    "deliverableId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "fileMatch" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "seenPublicAt" TIMESTAMP(3),

    CONSTRAINT "PostVideo_pkey" PRIMARY KEY ("deliverableId")
);
