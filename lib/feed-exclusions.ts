import { normalizeUrl } from './url-utils';

// Feed IDs that should never be imported or displayed
export const BLACKLISTED_FEED_IDS = [
  'lnurl-testing-podcast',
  'lnurl-test-feed',
  'podtards-test',
  'bitpunkfm-unwound',
  'bitpunk-fm-unwound-1768079479444',  // bitpunk.fm unwound podcast
];

// Feed URLs that should never be imported
export const BLACKLISTED_FEED_URLS = [
  'https://zine.bitpunk.fm/feeds/unwound.xml',
  'https://zine.bitpunk.fm/feeds/bitpunk-fm.xml',
];

// Feed URLs that duplicate content already available at a canonical source
// (e.g. Wavlake mirrors of albums the artist also publishes on their own site).
// Suppressed from automated re-import paths (Step 5b `import-albums` + podping
// auto-mint) but NOT hidden from the album grid — admin can still add them
// manually via /admin if ever needed. Without this list, deleting the duplicate
// just causes the next 4 AM cron to recreate it from PI API artist search.
export const DUPLICATE_SOURCE_FEED_URLS = [
  // Henrik Flyman — canonical feeds at henrikflyman.com
  'https://wavlake.com/feed/music/9a5340e4-50ca-48c3-9b06-3f6b782b5131',  // A Song For The Voiceless
  'https://wavlake.com/feed/music/9a218bec-4411-4f93-9caa-f3f84e4ef5f0',  // Authority
  'https://wavlake.com/feed/music/26822e8f-cc32-4f7b-b760-720cbe2455ff',  // Thorns
  'https://wavlake.com/feed/music/cca74ee8-67f8-434b-a386-8417e304cdf0',  // Time Waits For No One
  'https://wavlake.com/feed/music/b7f701d7-5499-48be-8394-fcd633c649bb',  // Dancing With A Ghost
  'https://wavlake.com/feed/music/e0c852e7-a118-46b0-a751-4e42ed6e0b6c',  // Shadowbanned
];

// Feed URLs that back a curated playlist. Not blacklisted (admin can add them as
// standalone podcasts), but playlist refresh must NOT auto-create feed records
// for them — otherwise every source podcast would silently appear on the site.
// Only admin-initiated imports should populate these.
export const PLAYLIST_SOURCE_FEED_URLS = [
  'https://music.behindthesch3m3s.com/b4ts%20feed/feed.xml',  // B4TS
  'https://mmmusic-project.ams3.cdn.digitaloceanspaces.com/Mutton_Mead__Music/feed.xml',  // MMM
  'https://feed.homegrownhits.xyz/feed.xml',  // HGH
  'https://sirlibre.com/lightning-thrashes-rss.xml',  // LT
  'https://serve.podhome.fm/rss/3aebb7a8-5942-5ee7-a148-8bdc14f1f3d4',  // Upbeats
  'https://itsamood.org/itsamoodrss.xml',  // IAM
  'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml',  // ITDV
  'https://serve.podhome.fm/rss/fafd2bfc-98ac-5010-9fcb-7403abfd420a',  // Two For Tunestr
];

const normalizedBlacklistedUrls = BLACKLISTED_FEED_URLS.map(normalizeUrl);
const normalizedDuplicateSourceUrls = DUPLICATE_SOURCE_FEED_URLS.map(normalizeUrl);
const normalizedPlaylistSourceUrls = PLAYLIST_SOURCE_FEED_URLS.map(normalizeUrl);

export function isBlacklistedFeedId(id: string): boolean {
  return BLACKLISTED_FEED_IDS.includes(id);
}

export function isBlacklistedFeedUrl(url: string): boolean {
  const normalized = normalizeUrl(url);
  return normalizedBlacklistedUrls.includes(normalized);
}

export function isDuplicateSourceUrl(url: string): boolean {
  const normalized = normalizeUrl(url);
  return normalizedDuplicateSourceUrls.includes(normalized);
}

// Combined check for automated re-import paths (Step 5b, podping auto-mint).
// Excludes both outright-banned URLs and duplicate-source mirrors.
export function isAutoImportSuppressedUrl(url: string): boolean {
  return isBlacklistedFeedUrl(url) || isDuplicateSourceUrl(url);
}

export function isPlaylistSourceFeedUrl(url: string): boolean {
  const normalized = normalizeUrl(url);
  return normalizedPlaylistSourceUrls.includes(normalized);
}

export function getBlacklistedFeedIds(): string[] {
  return [...BLACKLISTED_FEED_IDS];
}

// Bowl After Bowl is a podcast feed mis-imported as type='album' (slug
// /album/bowl-after-bowl) but its episodes are spoken-word podcast content.
// "Bowl Covers" (a derived music feed) is legitimate music — keep it.
// Used by both /api/albums-fast and /api/feeds/recent so the album grid
// stays free of the podcast.
export function isBowlAfterBowlPodcastEntry(entry: {
  id?: string | null;
  title?: string | null;
  artist?: string | null;
  feedUrl?: string | null;
}): boolean {
  const title = (entry.title || '').toLowerCase();
  const artist = (entry.artist || '').toLowerCase();
  const feedUrl = (entry.feedUrl || '').toLowerCase();

  // Always keep Bowl Covers (legitimate music content).
  if (entry.id === 'bowl-covers' || title.includes('bowl covers')) {
    return false;
  }

  return (
    (title.includes('bowl after bowl') && !title.includes('covers')) ||
    (artist.includes('bowl after bowl') && !title.includes('covers')) ||
    (feedUrl.includes('bowlafterbowl.com') && !title.includes('covers') && entry.id !== 'bowl-covers')
  );
}
