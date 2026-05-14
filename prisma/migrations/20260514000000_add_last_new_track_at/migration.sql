-- AlterTable
ALTER TABLE "Feed" ADD COLUMN "lastNewTrackAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Feed_lastNewTrackAt_idx" ON "Feed"("lastNewTrackAt");
