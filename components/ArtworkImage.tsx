import Image, { type ImageProps } from 'next/image';
import { isAnimatedArtworkUrl } from '@/lib/cdn-utils';

/**
 * Drop-in replacement for next/image at every site that renders artwork coming
 * from a podcast feed (album covers, track/episode art, avatars).
 *
 * Feed artwork is arbitrary: some feeds ship animated GIFs, and the Next
 * optimizer both refuses to optimize those and logs an error-severity warning
 * for each one. See `isAnimatedArtworkUrl` for the full story. This wrapper
 * marks exactly those images `unoptimized` and leaves every other image on the
 * normal optimized path.
 *
 * An explicit `unoptimized` prop still wins, so call sites can opt out.
 */
export default function ArtworkImage({ src, unoptimized, ...props }: ImageProps) {
  const animated = typeof src === 'string' && isAnimatedArtworkUrl(src);
  return <Image src={src} unoptimized={unoptimized ?? animated} {...props} />;
}
