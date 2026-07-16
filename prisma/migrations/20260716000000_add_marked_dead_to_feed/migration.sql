-- Add markedDead flag to Feed. A manual "flag as dead" for feeds taken down
-- upstream (e.g. removed from Wavlake). The row stays in the DB but is hidden
-- from all read surfaces and skipped by the Step 5b re-mint cron. Orthogonal
-- to `status` on purpose, so refresh/parse status transitions never clobber it.
ALTER TABLE "Feed" ADD COLUMN "markedDead" BOOLEAN NOT NULL DEFAULT false;
