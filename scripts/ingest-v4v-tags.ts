/**
 * Ingest crowd-sourced track tags from v4vmusic.com.
 *
 * V4V Music keys items by (feedGuid, itemGuid), which exactly matches our
 * (Feed.guid, Track.guid). Items with no matching DB row are silently skipped.
 *
 * Usage:
 *   npx tsx scripts/ingest-v4v-tags.ts
 *   npx tsx scripts/ingest-v4v-tags.ts --limit=100
 *
 * Read-only against v4vmusic — no API key required (anonymous = 100 req/hr).
 */

import { ingestV4vTags } from '../lib/v4v-tags-ingest';
import { prisma } from '../lib/prisma';

const limit = parseInt(process.env.V4V_TAG_LIMIT || process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '200');

async function main() {
  console.log(`Starting v4v tag ingest (limit=${limit})…`);
  const result = await ingestV4vTags({ limit, logger: (msg) => console.log(`  ${msg}`) });
  console.log(
    `Done in ${(result.durationMs / 1000).toFixed(1)}s. ` +
    `${result.tagsFetched} tags, ${result.itemsProcessed} items processed, ` +
    `${result.tracksMatched} matched, ${result.itemsSkipped} skipped.`
  );
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
