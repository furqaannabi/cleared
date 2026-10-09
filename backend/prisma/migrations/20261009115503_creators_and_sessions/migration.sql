-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "googleId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "madeFrom" TEXT,
    "welcomedAt" TIMESTAMP(3),
    "paypalEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectedAccount" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "synthetic" BOOLEAN NOT NULL DEFAULT false,
    "refreshTokenEncrypted" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Creator_googleId_key" ON "Creator"("googleId");

-- CreateIndex
CREATE INDEX "Creator_demo_madeFrom_createdAt_idx" ON "Creator"("demo", "madeFrom", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_creatorId_idx" ON "Session"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAccount_creatorId_platform_key" ON "ConnectedAccount"("creatorId", "platform");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectedAccount" ADD CONSTRAINT "ConnectedAccount_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
