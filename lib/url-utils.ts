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