/**
 * Generate a clean URL-friendly slug from a title
 * Preserves more information to avoid collisions
 */
export function generateAlbumSlug(title: string): string {
  // Special case handling for known problematic titles
  const specialCases: { [key: string]: string } = {
    'music from the doerfel-verse': 'music-from-the-doerfel-verse',
    'bloodshot lies - the album': 'bloodshot-lies',
    'dead time(live 2016)': 'dead-timelive-2016',
    'let go (what\'s holding you back)': 'let-go-whats-holding-you-back',
    'they don\'t know': 'they-dont-know',
    'underwater - single': 'underwater-single',
    'unsound existence (self-hosted version)': 'unsound-existence-self-hosted-version',
    'you feel like home(single)': 'you-feel-like-homesingle',
    'the kid, the dad, the mom & the tiny window': 'the-kid-the-dad-the-mom-and-the-tiny-window',
    'don\'t worry, you still have time to ruin it - demo': 'dont-worry-you-still-have-time-to-ruin-it-demo',
    'fake love - demo': 'fake-love-demo',
    'roommates - demo': 'roommates-demo',
    'orange pill, pink pill, white pill - demo': 'orange-pill-pink-pill-white-pill-demo',
    'strangers to lovers - live from sloe flower studio': 'strangers-to-lovers-live-from-sloe-flower-studio',
    'can\'t promise you the world - live from sloe flower studio': 'cant-promise-you-the-world-live-from-sloe-flower-studio',
    'heycitizen\'s lo-fi hip-hop beats to study and relax to': 'heycitizens-lo-fi-hip-hop-beats-to-study-and-relax-to',
    'fountain artist takeover - nate johnivan': 'fountain-artist-takeover-nate-johnivan',
    'rock\'n\'roll breakheart': 'rocknroll-breakheart',
    'thankful (feat. witt lowry)': 'thankful-feat-witt-lowry',
    'aged friends & old whiskey': 'aged-friends-and-old-whiskey'
  };
  
  const lowerTitle = title.toLowerCase().trim();
  if (specialCases[lowerTitle]) {
    return specialCases[lowerTitle];
  }
  
  // First, normalize the title
  let slug = title
    .toLowerCase()
    .trim()
    // Replace common special characters with their word equivalents
    .replace(/&/g, 'and')
    .replace(/\+/g, 'plus')
    .replace(/@/g, 'at')
    // Keep alphanumeric, spaces, and hyphens
    .replace(/[^a-z0-9\s-]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Replace spaces with hyphens
    .replace(/\s/g, '-')
    // Replace multiple hyphens with single hyphen
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-|-$/g, '');
  
  // If the slug is empty after processing, use a fallback
  if (!slug) {
    slug = 'album-' + Date.now();
  }
  
  return slug;
}

/**
 * Generate album URL path
 */
export function generateAlbumUrl(title: string, feedType?: string): string {
  const slug = generateAlbumSlug(title);
  if (feedType === 'podcast') return `/podcast/${slug}`;
  return `/album/${slug}`;
}

export function generatePodcastUrl(title: string): string {
  return `/podcast/${generateAlbumSlug(title)}`;
}

/**
 * Build the href for an album card/link. Use this instead of generateAlbumUrl(title).
 *
 * Album titles are not unique — four active feeds are literally titled "Singles"
 * (the-horse-heads-singles, frankie-peroni-singles, nathan-abbott-singles,
 * singles-1768078067901) — so a title-derived slug can only ever resolve to whichever
 * of them /api/albums/[slug] ranks highest (max trackCount, first wins on ties). That
 * is how the Horseheads Singles card ended up loading Frankie Peroni's album (#183).
 * Linking by the Feed row's primary key is unambiguous, and the resolver's first rung
 * is already an exact case-insensitive id match, so no route change is needed.
 *
 * feedId is preferred over id ON PURPOSE: /api/albums returns a *synthetic* id
 * (`${generateAlbumSlug(title)}-${feed.id.split('-')[0]}`, e.g. "singles-the") alongside
 * the real feedId, so preferring id would mint hrefs that resolve to nothing on the
 * podroll and the publisher-page client fallbacks. Do not flip this ordering.
 *
 * Falls back to the title slug when neither id is present, so callers carrying only a
 * title behave exactly as before. Existing title-slug URLs keep working either way —
 * the resolver's title rungs are untouched.
 */
export function generateAlbumHref(album: {
  feedId?: string | null;
  id?: string | null;
  title?: string | null;
}): string {
  const feedId = album.feedId?.trim() || album.id?.trim();
  if (feedId) return `/album/${encodeURIComponent(feedId)}`;
  return generateAlbumUrl(album.title ?? '');
}

/**
 * Generate a clean publisher slug from publisher info
 * Uses title/artist name if available, otherwise falls back to a shortened ID
 */
export function generatePublisherSlug(publisherInfo: { title?: string; artist?: string; feedGuid?: string }): string {
  // Try to use title or artist name first
  const name = publisherInfo.title || publisherInfo.artist;
  if (name) {
    return generateAlbumSlug(name);
  }
  
  // Fall back to a shortened version of the feedGuid
  if (publisherInfo.feedGuid) {
    return publisherInfo.feedGuid.split('-')[0]; // Use first part of UUID
  }
  
  // Last resort: use the full feedGuid
  return publisherInfo.feedGuid || 'unknown';
}

/**
 * Generate publisher URL path
 */
export function generatePublisherUrl(publisherInfo: { title?: string; artist?: string; feedGuid?: string }): string {
  return `/publisher/${generatePublisherSlug(publisherInfo)}`;
}

/**
 * Create a mapping of clean slugs to feedGuids for publisher routing
 * This allows us to use clean URLs while still being able to look up the original feedGuid
 */
export function createPublisherSlugMap(publishers: Array<{ title?: string; artist?: string; feedGuid?: string }>): Map<string, string> {
  const slugMap = new Map<string, string>();
  
  publishers.forEach(publisher => {
    if (publisher.feedGuid) {
      const slug = generatePublisherSlug(publisher);
      slugMap.set(slug, publisher.feedGuid);
    }
  });
  
  return slugMap;
}

/**
 * Extract a clean slug from a URL path
 */
export function extractSlugFromPath(path: string): string {
  return path.split('/').pop() || '';
}

/**
 * Generate a more readable URL for any entity
 */
export function generateCleanUrl(type: 'album' | 'publisher', identifier: string | { title?: string; artist?: string; feedGuid?: string }): string {
  if (type === 'album') {
    return generateAlbumUrl(identifier as string);
  } else {
    return generatePublisherUrl(identifier as { title?: string; artist?: string; feedGuid?: string });
  }
}

/**
 * Known publisher mappings for routing
 * Maps clean slugs to their corresponding feed URLs
 */
export const KNOWN_PUBLISHERS: { [slug: string]: { feedGuid: string; feedUrl: string; name?: string } } = {
  // The Doerfels - Family band from Buffalo, NY
  'the-doerfels': {
    feedGuid: 'doerfels-publisher-special',
    feedUrl: 'https://stablekraft.app/api/feeds/doerfels-pubfeed',
    name: 'The Doerfels'
  },
  'doerfels': {
    feedGuid: 'doerfels-publisher-special',
    feedUrl: 'https://stablekraft.app/api/feeds/doerfels-pubfeed',
    name: 'The Doerfels'
  },
  
  // IROH - Heavy Hazy Rock
  'iroh': {
    feedGuid: '8a9c2e54-785a-4128-9412-737610f5d00a',
    feedUrl: 'https://wavlake.com/feed/artist/8a9c2e54-785a-4128-9412-737610f5d00a',
    name: 'IROH'
  },
  
  // Joe Martin - Independent singer songwriter
  'joe-martin': {
    feedGuid: '18bcbf10-6701-4ffb-b255-bc057390d738',
    feedUrl: 'https://wavlake.com/feed/artist/18bcbf10-6701-4ffb-b255-bc057390d738',
    name: 'Joe Martin'
  },
  
  // My Friend Jimi
  'my-friend-jimi': {
    feedGuid: '0ea699be-e985-4aa1-8c00-43542e4b9e0d',
    feedUrl: 'https://wavlake.com/feed/artist/0ea699be-e985-4aa1-8c00-43542e4b9e0d',
    name: 'My Friend Jimi'
  },
  
  // Ollie
  'ollie': {
    feedGuid: 'd2f43e9f-adfc-4811-b9c1-58d5ea383275',
    feedUrl: 'https://wavlake.com/feed/artist/d2f43e9f-adfc-4811-b9c1-58d5ea383275',
    name: 'Ollie'
  },
  
  // Red Arrow Highway
  'red-arrow-highway': {
    feedGuid: '09465303-930a-4ee6-a18d-063cdc7fe3c9',
    feedUrl: 'https://wavlake.com/feed/artist/09465303-930a-4ee6-a18d-063cdc7fe3c9',
    name: 'Red Arrow Highway'
  },
  
  // Drawing Monsters
  'drawing-monsters': {
    feedGuid: 'cbcb895d-9a01-465f-af7b-9a09ffbc29f5',
    feedUrl: 'https://wavlake.com/feed/artist/cbcb895d-9a01-465f-af7b-9a09ffbc29f5',
    name: 'Drawing Monsters'
  },
  
  // Death by Lions
  'death-by-lions': {
    feedGuid: 'wavlake-publisher-1e7f8807',
    feedUrl: 'https://wavlake.com/feed/artist/1e7f8807-31a7-454c-b612-f2563ba4cf67',
    name: 'Death by Lions'
  },
  'wavlake-publisher-1e7f8807': {
    feedGuid: 'wavlake-publisher-1e7f8807',
    feedUrl: 'https://wavlake.com/feed/artist/1e7f8807-31a7-454c-b612-f2563ba4cf67',
    name: 'Death by Lions'
  },
  
  // Wavlake Publisher (generic)
  'wavlake-publisher': {
    feedGuid: 'aa909244-7555-4b52-ad88-7233860c6fb4',
    feedUrl: 'https://wavlake.com/feed/artist/aa909244-7555-4b52-ad88-7233860c6fb4',
    name: 'Wavlake Publisher'
  },
  'nate-johnivan': {
    feedGuid: 'aa909244-7555-4b52-ad88-7233860c6fb4',
    feedUrl: 'https://wavlake.com/feed/artist/aa909244-7555-4b52-ad88-7233860c6fb4',
    name: 'Nate Johnivan'
  },
  
  // Fallback for UUID-based URLs (backward compatibility)
  '18bcbf10': {
    feedGuid: '18bcbf10-6701-4ffb-b255-bc057390d738',
    feedUrl: 'https://wavlake.com/feed/artist/18bcbf10-6701-4ffb-b255-bc057390d738',
    name: 'Joe Martin'
  },
  '0ea699be': {
    feedGuid: '0ea699be-e985-4aa1-8c00-43542e4b9e0d',
    feedUrl: 'https://wavlake.com/feed/artist/0ea699be-e985-4aa1-8c00-43542e4b9e0d',
    name: 'My Friend Jimi'
  },
  'aa909244': {
    feedGuid: 'aa909244-7555-4b52-ad88-7233860c6fb4',
    feedUrl: 'https://wavlake.com/feed/artist/aa909244-7555-4b52-ad88-7233860c6fb4',
    name: 'Nate Johnivan'
  },
  '8a9c2e54': {
    feedGuid: '8a9c2e54-785a-4128-9412-737610f5d00a',
    feedUrl: 'https://wavlake.com/feed/artist/8a9c2e54-785a-4128-9412-737610f5d00a',
    name: 'IROH'
  },
  'd2f43e9f': {
    feedGuid: 'd2f43e9f-adfc-4811-b9c1-58d5ea383275',
    feedUrl: 'https://wavlake.com/feed/artist/d2f43e9f-adfc-4811-b9c1-58d5ea383275',
    name: 'Ollie'
  },
  '09465303': {
    feedGuid: '09465303-930a-4ee6-a18d-063cdc7fe3c9',
    feedUrl: 'https://wavlake.com/feed/artist/09465303-930a-4ee6-a18d-063cdc7fe3c9',
    name: 'Red Arrow Highway'
  },
  'cbcb895d': {
    feedGuid: 'cbcb895d-9a01-465f-af7b-9a09ffbc29f5',
    feedUrl: 'https://wavlake.com/feed/artist/cbcb895d-9a01-465f-af7b-9a09ffbc29f5',
    name: 'Drawing Monsters'
  },
  '1e7f8807': {
    feedGuid: 'wavlake-publisher-1e7f8807',
    feedUrl: 'https://wavlake.com/feed/artist/1e7f8807-31a7-454c-b612-f2563ba4cf67',
    name: 'Death by Lions'
  },

  // Additional Wavlake Publishers
  'bennyjeans': {
    feedGuid: 'wavlake-publisher-4e33ca0c',
    feedUrl: 'https://wavlake.com/feed/artist/4e33ca0c-bd98-4f98-9284-e8073046c049',
    name: 'bennyjeans'
  },
  'wavlake-publisher-4e33ca0c': {
    feedGuid: 'wavlake-publisher-4e33ca0c',
    feedUrl: 'https://wavlake.com/feed/artist/4e33ca0c-bd98-4f98-9284-e8073046c049',
    name: 'bennyjeans'
  },
  '4e33ca0c': {
    feedGuid: 'wavlake-publisher-4e33ca0c',
    feedUrl: 'https://wavlake.com/feed/artist/4e33ca0c-bd98-4f98-9284-e8073046c049',
    name: 'bennyjeans'
  },
  'big-awesome': {
    feedGuid: 'wavlake-publisher-93fbacab',
    feedUrl: 'https://wavlake.com/feed/artist/93fbacab-bbbb-4de4-863a-8adeb9fc4782',
    name: 'Big Awesome'
  },
  'wavlake-publisher-93fbacab': {
    feedGuid: 'wavlake-publisher-93fbacab',
    feedUrl: 'https://wavlake.com/feed/artist/93fbacab-bbbb-4de4-863a-8adeb9fc4782',
    name: 'Big Awesome'
  },
  '93fbacab': {
    feedGuid: 'wavlake-publisher-93fbacab',
    feedUrl: 'https://wavlake.com/feed/artist/93fbacab-bbbb-4de4-863a-8adeb9fc4782',
    name: 'Big Awesome'
  },
  'charlie-crown': {
    feedGuid: 'wavlake-publisher-707bc821',
    feedUrl: 'https://wavlake.com/feed/artist/707bc821-489e-46b2-8b51-d0aaad856f20',
    name: 'Charlie Crown'
  },
  'wavlake-publisher-707bc821': {
    feedGuid: 'wavlake-publisher-707bc821',
    feedUrl: 'https://wavlake.com/feed/artist/707bc821-489e-46b2-8b51-d0aaad856f20',
    name: 'Charlie Crown'
  },
  '707bc821': {
    feedGuid: 'wavlake-publisher-707bc821',
    feedUrl: 'https://wavlake.com/feed/artist/707bc821-489e-46b2-8b51-d0aaad856f20',
    name: 'Charlie Crown'
  },
  'cole-hansen': {
    feedGuid: 'wavlake-publisher-cc63b375',
    feedUrl: 'https://wavlake.com/feed/artist/cc63b375-8977-4048-9aee-99a500fb6108',
    name: 'Cole Hansen'
  },
  'wavlake-publisher-cc63b375': {
    feedGuid: 'wavlake-publisher-cc63b375',
    feedUrl: 'https://wavlake.com/feed/artist/cc63b375-8977-4048-9aee-99a500fb6108',
    name: 'Cole Hansen'
  },
  'cc63b375': {
    feedGuid: 'wavlake-publisher-cc63b375',
    feedUrl: 'https://wavlake.com/feed/artist/cc63b375-8977-4048-9aee-99a500fb6108',
    name: 'Cole Hansen'
  },
  'herbivore': {
    feedGuid: 'wavlake-publisher-eea2d330',
    feedUrl: 'https://wavlake.com/feed/artist/eea2d330-fc71-4e90-81de-3de819728c9d',
    name: 'Herbivore'
  },
  'wavlake-publisher-eea2d330': {
    feedGuid: 'wavlake-publisher-eea2d330',
    feedUrl: 'https://wavlake.com/feed/artist/eea2d330-fc71-4e90-81de-3de819728c9d',
    name: 'Herbivore'
  },
  'eea2d330': {
    feedGuid: 'wavlake-publisher-eea2d330',
    feedUrl: 'https://wavlake.com/feed/artist/eea2d330-fc71-4e90-81de-3de819728c9d',
    name: 'Herbivore'
  },
  'jessica-lynne-witty': {
    feedGuid: 'wavlake-publisher-6fa983b3',
    feedUrl: 'https://wavlake.com/feed/artist/6fa983b3-9aa2-4331-b22f-5f6d8dcdf3f2',
    name: 'Jessica Lynne Witty'
  },
  'wavlake-publisher-6fa983b3': {
    feedGuid: 'wavlake-publisher-6fa983b3',
    feedUrl: 'https://wavlake.com/feed/artist/6fa983b3-9aa2-4331-b22f-5f6d8dcdf3f2',
    name: 'Jessica Lynne Witty'
  },
  '6fa983b3': {
    feedGuid: 'wavlake-publisher-6fa983b3',
    feedUrl: 'https://wavlake.com/feed/artist/6fa983b3-9aa2-4331-b22f-5f6d8dcdf3f2',
    name: 'Jessica Lynne Witty'
  },
  'john-depew-trio': {
    feedGuid: 'wavlake-publisher-df5a4722',
    feedUrl: 'https://wavlake.com/feed/artist/df5a4722-cd42-429c-896d-caec1ad39600',
    name: 'John Depew Trio'
  },
  'wavlake-publisher-df5a4722': {
    feedGuid: 'wavlake-publisher-df5a4722',
    feedUrl: 'https://wavlake.com/feed/artist/df5a4722-cd42-429c-896d-caec1ad39600',
    name: 'John Depew Trio'
  },
  'df5a4722': {
    feedGuid: 'wavlake-publisher-df5a4722',
    feedUrl: 'https://wavlake.com/feed/artist/df5a4722-cd42-429c-896d-caec1ad39600',
    name: 'John Depew Trio'
  },
  'lara-j': {
    feedGuid: 'wavlake-publisher-912c0793',
    feedUrl: 'https://wavlake.com/feed/artist/912c0793-92cf-4726-a495-e5b1602693c0',
    name: 'Lara J'
  },
  'wavlake-publisher-912c0793': {
    feedGuid: 'wavlake-publisher-912c0793',
    feedUrl: 'https://wavlake.com/feed/artist/912c0793-92cf-4726-a495-e5b1602693c0',
    name: 'Lara J'
  },
  '912c0793': {
    feedGuid: 'wavlake-publisher-912c0793',
    feedUrl: 'https://wavlake.com/feed/artist/912c0793-92cf-4726-a495-e5b1602693c0',
    name: 'Lara J'
  },
  'late-night-special': {
    feedGuid: 'wavlake-publisher-bfb52718',
    feedUrl: 'https://wavlake.com/feed/artist/bfb52718-dcfd-44d6-af94-d05559be2f21',
    name: 'Late Night Special'
  },
  'wavlake-publisher-bfb52718': {
    feedGuid: 'wavlake-publisher-bfb52718',
    feedUrl: 'https://wavlake.com/feed/artist/bfb52718-dcfd-44d6-af94-d05559be2f21',
    name: 'Late Night Special'
  },
  'bfb52718': {
    feedGuid: 'wavlake-publisher-bfb52718',
    feedUrl: 'https://wavlake.com/feed/artist/bfb52718-dcfd-44d6-af94-d05559be2f21',
    name: 'Late Night Special'
  },
  'matt-johner': {
    feedGuid: 'wavlake-publisher-7ca38fae',
    feedUrl: 'https://wavlake.com/feed/artist/7ca38fae-f142-4ceb-ab0f-b17d92374315',
    name: 'Matt Johner'
  },
  'wavlake-publisher-7ca38fae': {
    feedGuid: 'wavlake-publisher-7ca38fae',
    feedUrl: 'https://wavlake.com/feed/artist/7ca38fae-f142-4ceb-ab0f-b17d92374315',
    name: 'Matt Johner'
  },
  '7ca38fae': {
    feedGuid: 'wavlake-publisher-7ca38fae',
    feedUrl: 'https://wavlake.com/feed/artist/7ca38fae-f142-4ceb-ab0f-b17d92374315',
    name: 'Matt Johner'
  },
  'ro-shapiro': {
    feedGuid: 'wavlake-publisher-299267e2',
    feedUrl: 'https://wavlake.com/feed/artist/299267e2-9309-4276-a22d-70b44f0be754',
    name: 'R.O. Shapiro'
  },
  'r-o-shapiro': {
    feedGuid: 'wavlake-publisher-299267e2',
    feedUrl: 'https://wavlake.com/feed/artist/299267e2-9309-4276-a22d-70b44f0be754',
    name: 'R.O. Shapiro'
  },
  'wavlake-publisher-299267e2': {
    feedGuid: 'wavlake-publisher-299267e2',
    feedUrl: 'https://wavlake.com/feed/artist/299267e2-9309-4276-a22d-70b44f0be754',
    name: 'R.O. Shapiro'
  },
  '299267e2': {
    feedGuid: 'wavlake-publisher-299267e2',
    feedUrl: 'https://wavlake.com/feed/artist/299267e2-9309-4276-a22d-70b44f0be754',
    name: 'R.O. Shapiro'
  },
  'ryan-fonda': {
    feedGuid: 'wavlake-publisher-d4c49f2e',
    feedUrl: 'https://wavlake.com/feed/artist/d4c49f2e-0b50-4a5e-8101-7543d68e032f',
    name: 'Ryan Fonda'
  },
  'wavlake-publisher-d4c49f2e': {
    feedGuid: 'wavlake-publisher-d4c49f2e',
    feedUrl: 'https://wavlake.com/feed/artist/d4c49f2e-0b50-4a5e-8101-7543d68e032f',
    name: 'Ryan Fonda'
  },
  'd4c49f2e': {
    feedGuid: 'wavlake-publisher-d4c49f2e',
    feedUrl: 'https://wavlake.com/feed/artist/d4c49f2e-0b50-4a5e-8101-7543d68e032f',
    name: 'Ryan Fonda'
  },
  'sara-jade': {
    feedGuid: 'wavlake-publisher-a8ad6318',
    feedUrl: 'https://wavlake.com/feed/artist/a8ad6318-7312-4f77-adbf-80b54944c8da',
    name: 'Sara Jade'
  },
  'wavlake-publisher-a8ad6318': {
    feedGuid: 'wavlake-publisher-a8ad6318',
    feedUrl: 'https://wavlake.com/feed/artist/a8ad6318-7312-4f77-adbf-80b54944c8da',
    name: 'Sara Jade'
  },
  'a8ad6318': {
    feedGuid: 'wavlake-publisher-a8ad6318',
    feedUrl: 'https://wavlake.com/feed/artist/a8ad6318-7312-4f77-adbf-80b54944c8da',
    name: 'Sara Jade'
  },
  'seth-fonda': {
    feedGuid: 'wavlake-publisher-d5067e8a',
    feedUrl: 'https://wavlake.com/feed/artist/d5067e8a-e2a2-47d7-a80c-b1a13def9a8d',
    name: 'Seth Fonda'
  },
  'wavlake-publisher-d5067e8a': {
    feedGuid: 'wavlake-publisher-d5067e8a',
    feedUrl: 'https://wavlake.com/feed/artist/d5067e8a-e2a2-47d7-a80c-b1a13def9a8d',
    name: 'Seth Fonda'
  },
  'd5067e8a': {
    feedGuid: 'wavlake-publisher-d5067e8a',
    feedUrl: 'https://wavlake.com/feed/artist/d5067e8a-e2a2-47d7-a80c-b1a13def9a8d',
    name: 'Seth Fonda'
  },
  'the-greensands': {
    feedGuid: 'wavlake-publisher-a8586318',
    feedUrl: 'https://wavlake.com/feed/artist/a8586318-c588-46ad-a769-ffb7e9c27b2c',
    name: 'The Greensands'
  },
  'wavlake-publisher-a8586318': {
    feedGuid: 'wavlake-publisher-a8586318',
    feedUrl: 'https://wavlake.com/feed/artist/a8586318-c588-46ad-a769-ffb7e9c27b2c',
    name: 'The Greensands'
  },
  'a8586318': {
    feedGuid: 'wavlake-publisher-a8586318',
    feedUrl: 'https://wavlake.com/feed/artist/a8586318-c588-46ad-a769-ffb7e9c27b2c',
    name: 'The Greensands'
  },
  'the-johner-boys': {
    feedGuid: 'wavlake-publisher-bd040774',
    feedUrl: 'https://wavlake.com/feed/artist/bd040774-1dd6-42c6-98ce-01d327697a1d',
    name: 'The Johner Boys'
  },
  'wavlake-publisher-bd040774': {
    feedGuid: 'wavlake-publisher-bd040774',
    feedUrl: 'https://wavlake.com/feed/artist/bd040774-1dd6-42c6-98ce-01d327697a1d',
    name: 'The Johner Boys'
  },
  'bd040774': {
    feedGuid: 'wavlake-publisher-bd040774',
    feedUrl: 'https://wavlake.com/feed/artist/bd040774-1dd6-42c6-98ce-01d327697a1d',
    name: 'The Johner Boys'
  },
  'theo-katzman': {
    feedGuid: 'wavlake-publisher-09954f14',
    feedUrl: 'https://wavlake.com/feed/artist/09954f14-c5a7-4680-90f4-0869243b9c26',
    name: 'Theo Katzman'
  },
  'wavlake-publisher-09954f14': {
    feedGuid: 'wavlake-publisher-09954f14',
    feedUrl: 'https://wavlake.com/feed/artist/09954f14-c5a7-4680-90f4-0869243b9c26',
    name: 'Theo Katzman'
  },
  '09954f14': {
    feedGuid: 'wavlake-publisher-09954f14',
    feedUrl: 'https://wavlake.com/feed/artist/09954f14-c5a7-4680-90f4-0869243b9c26',
    name: 'Theo Katzman'
  },
  'vertigo-kidd': {
    feedGuid: 'wavlake-publisher-eff27dd6',
    feedUrl: 'https://wavlake.com/feed/artist/eff27dd6-764c-497e-81fe-3a7e10eb7b3b',
    name: 'Vertigo Kidd'
  },
  'wavlake-publisher-eff27dd6': {
    feedGuid: 'wavlake-publisher-eff27dd6',
    feedUrl: 'https://wavlake.com/feed/artist/eff27dd6-764c-497e-81fe-3a7e10eb7b3b',
    name: 'Vertigo Kidd'
  },
  'eff27dd6': {
    feedGuid: 'wavlake-publisher-eff27dd6',
    feedUrl: 'https://wavlake.com/feed/artist/eff27dd6-764c-497e-81fe-3a7e10eb7b3b',
    name: 'Vertigo Kidd'
  },

  // Kathryn - Fountain.fm publisher
  'kathryn': {
    feedGuid: '9efcded5-19a4-56cd-ba5e-8f521c35cb23',
    feedUrl: 'https://feeds.fountain.fm/jokW9pKTREMn9bhoZSRU',
    name: 'Kathryn'
  },
  '9efcded5': {
    feedGuid: '9efcded5-19a4-56cd-ba5e-8f521c35cb23',
    feedUrl: 'https://feeds.fountain.fm/jokW9pKTREMn9bhoZSRU',
    name: 'Kathryn'
  },

  // CityBeach - Self-hosted publisher feed
  'citybeach': {
    feedGuid: 'sirtjthewrathful-publisher',
    feedUrl: 'https://www.sirtjthewrathful.com/publisher.xml',
    name: 'CityBeach'
  },
  'city-beach': {
    feedGuid: 'sirtjthewrathful-publisher',
    feedUrl: 'https://www.sirtjthewrathful.com/publisher.xml',
    name: 'CityBeach'
  }
};

/**
 * Get publisher info from a slug (clean URL or UUID)
 */
export function getPublisherInfo(slug: string): { feedGuid: string; feedUrl: string; name?: string } | null {
  // First try exact match
  if (KNOWN_PUBLISHERS[slug]) {
    return KNOWN_PUBLISHERS[slug];
  }

  // Try without -publisher suffix (e.g., "ollie-publisher" -> "ollie")
  const normalizedSlug = slug.replace(/-publisher$/, '');
  if (normalizedSlug !== slug && KNOWN_PUBLISHERS[normalizedSlug]) {
    return KNOWN_PUBLISHERS[normalizedSlug];
  }

  // Try to find by partial UUID match
  for (const [, publisher] of Object.entries(KNOWN_PUBLISHERS)) {
    if (publisher.feedGuid.startsWith(slug) || slug.startsWith(publisher.feedGuid.split('-')[0])) {
      return publisher;
    }
    // Also try normalized slug
    if (publisher.feedGuid.startsWith(normalizedSlug) || normalizedSlug.startsWith(publisher.feedGuid.split('-')[0])) {
      return publisher;
    }
  }

  return null;
}

/**
 * Async version that also checks database for publisher info
 * Use this when you need database fallback after static mapping check
 */
export async function getPublisherInfoAsync(
  slug: string,
  prisma: any
): Promise<{ feedGuid: string; feedUrl: string; name?: string } | null> {
  // First try static mapping
  const staticInfo = getPublisherInfo(slug);
  if (staticInfo) {
    return staticInfo;
  }

  const normalizedSlug = slug.replace(/-publisher$/, '');

  // Convert slug to title case for matching (e.g., "chris-nichols" -> "Chris Nichols")
  const possibleTitle = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const normalizedTitle = normalizedSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  try {
    // Query database for publisher feed
    const publisherFeed = await prisma.feed.findFirst({
      where: {
        type: 'publisher',
        status: 'active',
        OR: [
          { id: slug },
          { id: { contains: slug, mode: 'insensitive' } },
          { title: { equals: possibleTitle, mode: 'insensitive' } },
          { title: { equals: normalizedTitle, mode: 'insensitive' } },
          { artist: { equals: possibleTitle, mode: 'insensitive' } },
          { artist: { equals: normalizedTitle, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        title: true,
        artist: true,
        originalUrl: true
      }
    });

    if (publisherFeed) {
      return {
        feedGuid: publisherFeed.id,
        feedUrl: publisherFeed.originalUrl || '',
        name: publisherFeed.title || publisherFeed.artist || slug
      };
    }

    return null;
  } catch (error) {
    console.error('Error querying database for publisher:', error);
    return null;
  }
}

/**
 * Normalize artist name for consistent matching
 * Handles case differences, special characters, and common variations
 */
export function normalizeArtistName(name: string): string {
  if (!name) return '';

  return name
    .toLowerCase()
    .trim()
    // Replace special characters with their equivalents
    .replace(/&/g, 'and')
    .replace(/\+/g, 'plus')
    .replace(/@/g, 'at')
    // Remove most special characters but keep letters, numbers, spaces
    .replace(/[^a-z0-9\s]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two artist names match (case-insensitive, normalized)
 */
export function artistNamesMatch(name1: string | null | undefined, name2: string | null | undefined): boolean {
  if (!name1 || !name2) return false;
  return normalizeArtistName(name1) === normalizeArtistName(name2);
}

/**
 * Validate that a string is a valid URL
 * Returns true if valid, false otherwise
 */
export function isValidUrl(urlString: string | null | undefined): boolean {
  if (!urlString || typeof urlString !== 'string') {
    return false;
  }

  try {
    const url = new URL(urlString);
    // Must be http or https protocol
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate a feed URL specifically
 * Checks for valid URL structure and common RSS/XML feed patterns
 */
export function isValidFeedUrl(urlString: string | null | undefined): boolean {
  if (!isValidUrl(urlString)) {
    return false;
  }

  try {
    const url = new URL(urlString!);

    // Block obviously invalid hosts
    if (!url.hostname || url.hostname === 'localhost' && process.env.NODE_ENV === 'production') {
      return false;
    }

    // Must have a proper domain (at least one dot for TLD, unless localhost in dev)
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Normalize a URL for consistent storage
 * - Removes trailing slashes
 * - Decodes URL-encoded characters where safe
 * - Ensures https when possible
 */
export function normalizeUrl(urlString: string): string {
  try {
    const url = new URL(urlString);

    // Upgrade http to https for known secure hosts
    const secureHosts = ['wavlake.com', 'podcastindex.org', 'api.podcastindex.org', 'feeds.fountain.fm'];
    if (url.protocol === 'http:' && secureHosts.some(host => url.hostname.endsWith(host))) {
      url.protocol = 'https:';
    }

    // Remove trailing slash from pathname (except for root)
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    // If URL parsing fails, return as-is
    return urlString;
  }
}

/**
 * Build the ordered, deduped set of URL forms to try when looking a feed up by URL.
 * Normalized form first (that's what write paths store), then the raw form when it
 * differs — `normalizeUrl` fixes trailing slashes and space-vs-%20, so the raw form
 * catches rows written before normalization or via a path that skipped it.
 *
 * Pure and dependency-free so it stays unit-testable; the DB ladder that consumes it
 * lives in lib/feed-lookup.ts. Note this deliberately does NOT collapse case — case
 * differences are handled by that ladder's case-insensitive rung, not here.
 */
export function buildFeedUrlVariants(...urls: Array<string | null | undefined>): string[] {
  const variants = new Set<string>();

  for (const url of urls) {
    if (!url) continue;
    const normalized = normalizeUrl(url);
    variants.add(normalized);
    if (url !== normalized) variants.add(url);
  }

  return Array.from(variants);
}

/**
 * Percent-decode a URL's path/query/hash, leaving scheme and host untouched.
 * Returns null when there is nothing to decode or the input can't be decoded.
 *
 * The origin is preserved verbatim on purpose: a blanket `decodeURIComponent` over the
 * whole string would turn a `%2F` into `/` and could rewrite what looks like the host.
 */
function decodeUrlPath(urlString: string): string | null {
  try {
    const { origin } = new URL(urlString);
    // `origin` is "null" for non-http(s) schemes and won't prefix the input; bail rather
    // than slicing at the wrong offset.
    const rest = urlString.startsWith(origin) ? urlString.slice(origin.length) : null;
    if (rest === null) return null;

    const decoded = origin + decodeURIComponent(rest);
    return decoded === urlString ? null : decoded;
  } catch {
    // `new URL` throws on unparseable input; `decodeURIComponent` throws URIError on a
    // malformed escape (e.g. "%zz"). Either way there's no decoded form to offer.
    return null;
  }
}

/**
 * `buildFeedUrlVariants` plus a percent-decoded form of each variant.
 *
 * Only the decode direction is new — `normalizeUrl` already turns an incoming literal
 * space into `%20`, so a query in the raw form finds an encoded row. The reverse was the
 * gap: ~69 prod rows store `originalUrl` with literal spaces (written by paths
 * deliberately off the ladder — playlist import, bulk import, lib/feed-discovery.ts), so a
 * podping carrying the correct `%20` form couldn't see them and minted a duplicate row
 * instead. That happened 17 times before it was caught.
 *
 * Pure and dependency-free, same as `buildFeedUrlVariants`; consumed by the loose rung in
 * lib/feed-lookup.ts. Like that function it does NOT collapse case — the DB rung's
 * `mode: 'insensitive'` handles the case dimension, this handles the encoding one.
 */
export function buildFeedUrlLooseVariants(...urls: Array<string | null | undefined>): string[] {
  const variants = new Set<string>(buildFeedUrlVariants(...urls));

  for (const variant of Array.from(variants)) {
    const decoded = decodeUrlPath(variant);
    if (decoded) variants.add(decoded);
  }

  return Array.from(variants);
}

/**
 * Extract a UUID from a URL path, e.g.
 *   https://serve.podhome.fm/rss/3aebb7a8-5942-5ee7-a148-8bdc14f1f3d4
 *   → "3aebb7a8-5942-5ee7-a148-8bdc14f1f3d4"
 * Returns lowercase canonical form or null.
 */
export function extractUuidFromUrl(url: string): string | null {
  const m = url.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Extract the bare host from a feed URL for host-based matching, e.g.
 *   https://www.leuenbergmusic.com/podcast/foo/feed.xml → "leuenbergmusic.com"
 * Lowercases and strips a leading "www.". Returns '' when the URL can't be
 * parsed, so callers can treat unparseable URLs as "no host" (never a match).
 */
export function feedUrlHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}
