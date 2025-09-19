-- CreateTable
CREATE TABLE "public"."Feed" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "originalUrl" TEXT NOT NULL,
    "cdnUrl" TEXT,
    "type" TEXT NOT NULL DEFAULT 'album',
    "artist" TEXT,
    "image" TEXT,
    "language" TEXT,
    "category" TEXT,
    "explicit" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastFetched" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Track" (
    "id" TEXT NOT NULL,
    "guid" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "artist" TEXT,
    "album" TEXT,
    "audioUrl" TEXT NOT NULL,
    "duration" INTEGER,
    "explicit" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "publishedAt" TIMESTAMP(3),
    "itunesAuthor" TEXT,
    "itunesSummary" TEXT,
    "itunesImage" TEXT,
    "itunesDuration" TEXT,
    "itunesKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "itunesCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "v4vRecipient" TEXT,
    "v4vValue" JSONB,
    "startTime" DOUBLE PRECISION,
    "endTime" DOUBLE PRECISION,
    "searchVector" TEXT,
    "feedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlaylistTrack" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedBy" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserPlaylist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPlaylist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Feed_originalUrl_key" ON "public"."Feed"("originalUrl");

-- CreateIndex
CREATE INDEX "Feed_status_priority_idx" ON "public"."Feed"("status", "priority");

-- CreateIndex
CREATE INDEX "Feed_type_idx" ON "public"."Feed"("type");

-- CreateIndex
CREATE INDEX "Feed_lastFetched_idx" ON "public"."Feed"("lastFetched");

-- CreateIndex
CREATE UNIQUE INDEX "Track_guid_key" ON "public"."Track"("guid");

-- CreateIndex
CREATE INDEX "Track_feedId_idx" ON "public"."Track"("feedId");

-- CreateIndex
CREATE INDEX "Track_publishedAt_idx" ON "public"."Track"("publishedAt");

-- CreateIndex
CREATE INDEX "Track_artist_idx" ON "public"."Track"("artist");

-- CreateIndex
CREATE INDEX "Track_album_idx" ON "public"."Track"("album");

-- CreateIndex
CREATE INDEX "Track_title_idx" ON "public"."Track"("title");

-- CreateIndex
CREATE INDEX "Track_guid_idx" ON "public"."Track"("guid");

-- CreateIndex
CREATE INDEX "PlaylistTrack_playlistId_position_idx" ON "public"."PlaylistTrack"("playlistId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistTrack_playlistId_trackId_key" ON "public"."PlaylistTrack"("playlistId", "trackId");

-- CreateIndex
CREATE INDEX "UserPlaylist_createdBy_idx" ON "public"."UserPlaylist"("createdBy");

-- CreateIndex
CREATE INDEX "UserPlaylist_isPublic_idx" ON "public"."UserPlaylist"("isPublic");

-- AddForeignKey
ALTER TABLE "public"."Track" ADD CONSTRAINT "Track_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "public"."Feed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
