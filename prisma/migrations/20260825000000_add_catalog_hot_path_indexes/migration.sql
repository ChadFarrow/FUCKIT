-- Catalog hot-path indexes. Indexes only: no column is added, changed or
-- dropped, so this is safe to apply BEFORE the code that benefits from it, and
-- safe to leave in place if that code is rolled back.
--
-- Railway does not run migrations on deploy (CLAUDE.md / issue #122), so apply
-- this by hand before merging the PR:
--   railway run --service StableKraft --environment production npm run db:migrate
--
-- NOT `CONCURRENTLY`, deliberately. Prisma Migrate runs a migration file inside
-- a transaction on PostgreSQL, and `CREATE INDEX CONCURRENTLY` cannot run in a
-- transaction block — it would fail the whole migration. A plain CREATE INDEX
-- takes a write lock on the table while it builds; at this catalogue's size
-- (~1,500 Feed rows, tens of thousands of Track rows) that is seconds, and
-- reads are unaffected throughout.
--
-- IF NOT EXISTS makes a re-run harmless.

-- The albums-fast main query:
--   WHERE status = 'active' AND "markedDead" = false
--   ORDER BY priority ASC, "createdAt" DESC
-- "Feed_status_priority_createdAt_idx" is all-ascending, and Postgres cannot
-- walk an ascending index to satisfy a mixed-direction ORDER BY — so every
-- cache miss full-sorted the entire active catalogue.
CREATE INDEX IF NOT EXISTS "Feed_catalog_grid_idx"
  ON "Feed" ("status", "markedDead", "priority" ASC, "createdAt" DESC);

-- "markedDead" appears in 15+ hot WHERE clauses (albums-fast, feeds/recent,
-- publishers, search, opml, parsed-feeds) and appeared in NO index at all, so
-- every one of them discarded rows after the index scan.
CREATE INDEX IF NOT EXISTS "Feed_status_markedDead_type_idx"
  ON "Feed" ("status", "markedDead", "type");

-- Read on every albums-fast and every feeds/recent request; unindexed.
CREATE INDEX IF NOT EXISTS "Feed_type_musicShowOnly_idx"
  ON "Feed" ("type", "musicShowOnly");

-- The hottest query in the app. The nested Track select under every feed makes
-- Prisma emit
--   ROW_NUMBER() OVER (PARTITION BY "feedId"
--                      ORDER BY "trackOrder", "publishedAt", "createdAt")
-- with a LIMIT, and "Track_feedId_status_idx" covers only the filter half — the
-- partition sort had no index behind it. This lets the window read pre-sorted.
CREATE INDEX IF NOT EXISTS "Track_feed_ordered_idx"
  ON "Track" ("feedId", "status", "trackOrder", "publishedAt", "createdAt");
