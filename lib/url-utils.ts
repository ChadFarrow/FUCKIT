/**
 * Generate a clean URL-friendly slug from a title
 * Preserves more information to avoid collisions
 */
export function generateAlbumSlug(title: string): string {
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
export function generateAlbumUrl(title: string): string {
  return `/album/${generateAlbumSlug(title)}`;
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
    feedUrl: 'https://re.podtards.com/api/feeds/doerfels-pubfeed',
    name: 'The Doerfels'
  },
  'doerfels': {
    feedGuid: 'doerfels-publisher-special',
    feedUrl: 'https://re.podtards.com/api/feeds/doerfels-pubfeed',
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
  
  // BitPunk.fm - Low-fi audiozine
  'bitpunkfm': {
    feedGuid: '5883e6be-4e0c-11f0-9524-00155dc57d8e',
    feedUrl: 'https://zine.bitpunk.fm/feeds/publisher.xml',
    name: 'BitPunk.fm'
  },
  'bitpunk-fm': {
    feedGuid: '5883e6be-4e0c-11f0-9524-00155dc57d8e',
    feedUrl: 'https://zine.bitpunk.fm/feeds/publisher.xml',
    name: 'BitPunk.fm'
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
  '5883e6be': {
    feedGuid: '5883e6be-4e0c-11f0-9524-00155dc57d8e',
    feedUrl: 'https://zine.bitpunk.fm/feeds/publisher.xml',
    name: 'BitPunk.fm'
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
  
  // Try to find by partial UUID match
  for (const [, publisher] of Object.entries(KNOWN_PUBLISHERS)) {
    if (publisher.feedGuid.startsWith(slug) || slug.startsWith(publisher.feedGuid.split('-')[0])) {
      return publisher;
    }
  }
  
  return null;
} 