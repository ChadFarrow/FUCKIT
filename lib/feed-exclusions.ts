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
const normalizedPlaylistSourceUrls = PLAYLIST_SOURCE_FEED_URLS.map(normalizeUrl);

export function isBlacklistedFeedId(id: string): boolean {
  return BLACKLISTED_FEED_IDS.includes(id);
}

export function isBlacklistedFeedUrl(url: string): boolean {
  const normalized = normalizeUrl(url);
  return normalizedBlacklistedUrls.includes(normalized);
}

export function isPlaylistSourceFeedUrl(url: string): boolean {
  const normalized = normalizeUrl(url);
  return normalizedPlaylistSourceUrls.includes(normalized);
}

export function getBlacklistedFeedIds(): string[] {
  return [...BLACKLISTED_FEED_IDS];
}
