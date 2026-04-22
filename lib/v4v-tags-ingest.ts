import { prisma } from '@/lib/prisma';

const V4V_BASE = 'https://v4vmusic.com';
// v4vmusic /items/bytag responses can take 30+ seconds for popular tags. Generous timeout required.
const FETCH_TIMEOUT_MS = 90_000;
const PARALLEL_BATCH = 3;

export interface PopularTag { name: string; count: number; }
export interface V4vItem { feedGuid: string; itemGuid: string; title?: string; artistName?: string; }

export interface IngestResult {
  tagsFetched: number;
  itemsProcessed: number;
  tracksMatched: number;
  itemsSkipped: number;
  durationMs: number;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

export async function ingestV4vTags(opts: { limit?: number; logger?: (msg: string) => void } = {}): Promise<IngestResult> {
  const limit = opts.limit ?? 200;
  const log = opts.logger ?? (() => {});
  const t0 = Date.now();

  const popular = await fetchJson<{ tags: PopularTag[] }>(`${V4V_BASE}/api/public/tags/popular?limit=${limit}`);
  if (!popular?.tags?.length) {
    return { tagsFetched: 0, itemsProcessed: 0, tracksMatched: 0, itemsSkipped: 0, durationMs: Date.now() - t0 };
  }
  log(`Got ${popular.tags.length} popular tags`);

  const allFeeds = await prisma.feed.findMany({ select: { id: true, guid: true } });
  const feedByGuid = new Map<string, string>();
  for (const f of allFeeds) {
    if (f.guid) feedByGuid.set(f.guid, f.id);
  }

  const tagIdByName = new Map<string, number>();
  const now = new Date();
  for (const t of popular.tags) {
    const tag = await prisma.tag.upsert({
      where: { name: t.name },
      create: { name: t.name, count: 0, source: 'v4vmusic', updatedAt: now },
      update: { updatedAt: now },
      select: { id: true, name: true },
    });
    tagIdByName.set(tag.name, tag.id);
  }

  let tracksMatched = 0;
  let itemsSkipped = 0;
  let itemsProcessed = 0;

  for (let i = 0; i < popular.tags.length; i += PARALLEL_BATCH) {
    const batch = popular.tags.slice(i, i + PARALLEL_BATCH);
    await Promise.all(batch.map(async (t) => {
      const items = await fetchJson<V4vItem[]>(`${V4V_BASE}/api/public/items/bytag/${encodeURIComponent(t.name)}`);
      if (!Array.isArray(items)) return;
      itemsProcessed += items.length;
      const tagId = tagIdByName.get(t.name);
      if (!tagId) return;

      for (const item of items) {
        if (!item.feedGuid || !item.itemGuid) { itemsSkipped++; continue; }
        const feedId = feedByGuid.get(item.feedGuid);
        if (!feedId) { itemsSkipped++; continue; }
        const track = await prisma.track.findFirst({
          where: { feedId, guid: item.itemGuid },
          select: { id: true },
        });
        if (!track) { itemsSkipped++; continue; }
        await prisma.trackTag.upsert({
          where: { trackId_tagId: { trackId: track.id, tagId } },
          create: { trackId: track.id, tagId, source: 'v4vmusic' },
          update: {},
        });
        tracksMatched++;
      }
    }));
  }

  // Refresh denormalized counts
  for (const [, tagId] of tagIdByName) {
    const count = await prisma.trackTag.count({ where: { tagId } });
    await prisma.tag.update({ where: { id: tagId }, data: { count, updatedAt: new Date() } });
  }

  return {
    tagsFetched: popular.tags.length,
    itemsProcessed,
    tracksMatched,
    itemsSkipped,
    durationMs: Date.now() - t0,
  };
}
