// Podcasting 2.0 <podcast:image> tag (replaces deprecated <podcast:images srcset>).
// Multiple instances allowed at channel and item level.
// https://podcasting2.org/docs/podcast-namespace/tags/image
//
// This module is dependency-free on purpose so it can be imported from both the
// server-side RSS parser and client components without pulling in rss-parser /
// fast-xml-parser into the browser bundle.

export interface PodcastImage {
  href: string;
  alt?: string;
  aspectRatio?: string; // raw CSS ratio, e.g. "1/1", "16/9"
  width?: number;
  height?: number;
  type?: string;        // MIME type
  purpose?: string;     // space-separated tokens, e.g. "artwork", "canvas", "circular"
}

/** Pick the best square artwork href from a list of <podcast:image> variants, if any.
 *  Prefers a 1/1 aspect-ratio; falls back to a purpose of artwork/circular. Used to
 *  populate the legacy single image field only when no other image source exists. */
export function pickSquareArtwork(images: PodcastImage[] | null | undefined): string | undefined {
  if (!images || images.length === 0) return undefined;
  const square = images.find((img) => img.aspectRatio === '1/1');
  if (square) return square.href;
  const byPurpose = images.find((img) => /\b(artwork|circular)\b/i.test(img.purpose || ''));
  return byPurpose?.href;
}

/** Pick a full-bleed background href from <podcast:image> variants for the given orientation.
 *  'landscape' targets 16/9, 'portrait' targets 9/16. Prefers a purpose of "canvas" with the
 *  matching aspect-ratio, then any image with that ratio. Returns undefined (caller falls back
 *  to album art) rather than cross-stretching a landscape image into a portrait slot. */
export function pickCanvasBackground(
  images: PodcastImage[] | null | undefined,
  orientation: 'landscape' | 'portrait'
): string | undefined {
  if (!images || images.length === 0) return undefined;
  const targetRatio = orientation === 'landscape' ? '16/9' : '9/16';
  const canvas = images.find(
    (img) => img.aspectRatio === targetRatio && /\bcanvas\b/i.test(img.purpose || '')
  );
  if (canvas) return canvas.href;
  const anyRatio = images.find((img) => img.aspectRatio === targetRatio);
  return anyRatio?.href;
}
