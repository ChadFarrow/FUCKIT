import { ApiCache } from '@/lib/api-utils';

export const CACHE_TTL = 5 * 60 * 1000;

const searchCache = new ApiCache();

export function getSearchCache(): ApiCache {
  return searchCache;
}

export function invalidateSearchCache(): void {
  searchCache.clear();
}
