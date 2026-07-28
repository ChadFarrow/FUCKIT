-- CreateTable
CREATE TABLE "BoostFailure" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "userActionable" BOOLEAN NOT NULL,
    "scope" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "recipient" TEXT,
    "trackTitle" TEXT,
    "artistName" TEXT,
    "feedId" TEXT,
    "trackId" TEXT,
    "paymentType" TEXT,
    "error" TEXT NOT NULL,

    CONSTRAINT "BoostFailure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientErrorReport" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "samplePath" TEXT,
    "samplePlatform" TEXT,
    "sampleData" TEXT,

    CONSTRAINT "ClientErrorReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoostFailure_createdAt_idx" ON "BoostFailure"("createdAt");

-- CreateIndex
CREATE INDEX "BoostFailure_category_createdAt_idx" ON "BoostFailure"("category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientErrorReport_day_level_category_message_key" ON "ClientErrorReport"("day", "level", "category", "message");

-- CreateIndex
CREATE INDEX "ClientErrorReport_day_idx" ON "ClientErrorReport"("day");

-- CreateIndex
CREATE INDEX "ClientErrorReport_category_day_idx" ON "ClientErrorReport"("category", "day");
