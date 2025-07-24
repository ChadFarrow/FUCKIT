/**
 * Generate a clean URL-friendly slug from a title
 * Replaces spaces with hyphens and removes special characters
 */
export function generateAlbumSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
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
  // The Doerfels
  'the-doerfels': {
    feedGuid: '5526a0ee-069d-4c76-8bd4-7fd2022034bc',
    feedUrl: 'http://localhost:3000/doerfels-publisher-feed.xml',
    name: 'The Doerfels'
  },
  // Nate Johnivan
  'nate-johnivan': {
    feedGuid: 'aa909244-7555-4b52-ad88-7233860c6fb4',
    feedUrl: 'https://wavlake.com/feed/artist/aa909244-7555-4b52-ad88-7233860c6fb4',
    name: 'Nate Johnivan'
  },
  // Joe Martin
  'joe-martin': {
    feedGuid: '18bcbf10-6701-4ffb-b255-bc057390d738',
    feedUrl: 'https://wavlake.com/feed/artist/18bcbf10-6701-4ffb-b255-bc057390d738',
    name: 'Joe Martin'
  },
  // IROH
  'iroh': {
    feedGuid: '8a9c2e54-785a-4128-9412-737610f5d00a',
    feedUrl: 'https://wavlake.com/feed/artist/8a9c2e54-785a-4128-9412-737610f5d00a',
    name: 'IROH'
  },
  // Fallback for UUID-based URLs (backward compatibility)
  '5526a0ee': {
    feedGuid: '5526a0ee-069d-4c76-8bd4-7fd2022034bc',
    feedUrl: 'http://localhost:3000/doerfels-publisher-feed.xml',
    name: 'The Doerfels'
  },
  '18bcbf10': {
    feedGuid: '18bcbf10-6701-4ffb-b255-bc057390d738',
    feedUrl: 'https://wavlake.com/feed/artist/18bcbf10-6701-4ffb-b255-bc057390d738',
    name: 'Joe Martin'
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
  for (const [key, publisher] of Object.entries(KNOWN_PUBLISHERS)) {
    if (publisher.feedGuid.startsWith(slug) || slug.startsWith(publisher.feedGuid.split('-')[0])) {
      return publisher;
    }
  }
  
  return null;
} 