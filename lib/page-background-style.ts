import type { CSSProperties } from 'react';

/**
 * The full-bleed artwork background used by the album/podcast page and the
 * playlist pages.
 *
 * WHY THIS IS A SHARED MODULE: the style object was written out twice, verbatim,
 * in `app/album/[id]/AlbumDetailClient.tsx` and `components/PlaylistTemplateCompact.tsx`.
 * Both carried the same defect, so fixing the one that was reported would have left
 * the other one broken and looking fixed.
 *
 * THE DEFECT (issue #201, "background art switches to stock art"): the artwork
 * branch painted only
 *
 *     linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(<artwork>)
 *
 * with no opaque colour under it. That gradient is 40-60% black — see-through — so
 * for as long as the `url()` had not loaded, the layer was a tinted sheet of glass.
 * `app/layout.tsx` paints `/stablekraft-rocket.webp` at z-0 and this layer sits at
 * z-1, so the stock rocket wallpaper showed straight through it. The no-artwork
 * branch never had the problem: its gradient is opaque.
 *
 * That made switching album pages flash the stock wallpaper before the album art,
 * because the artwork URL is an `enhance=true&minWidth=1920&minHeight=1080` sharp
 * upscale through `/api/proxy-image` — hundreds of milliseconds of transparency,
 * every navigation. It is worst on a client-side navigation, where the anti-flicker
 * cache (`backgroundCacheById`) seeds a background URL immediately, so the layer
 * turns translucent before the new image has even been requested.
 *
 * THE FIX: put the opaque base gradient underneath the artwork as a third
 * background layer. `background-image` layers paint front-to-back, so the base sits
 * below the artwork and shows only where the artwork has not painted yet. The
 * loading state is then identical to the no-artwork state, and the rocket can never
 * show through in either.
 *
 * A `background-color` would also have closed the hole, but a flat colour under a
 * gradient means the two states do not match; keeping one gradient for both is why
 * `PAGE_BACKGROUND_BASE` is a single constant reused by both branches.
 */

/**
 * The opaque dark gradient every page background falls back to. Opaque is the
 * load-bearing property: anything translucent here reopens issue #201.
 */
export const PAGE_BACKGROUND_BASE =
  'linear-gradient(to bottom right, rgb(17, 24, 39), rgb(31, 41, 55), rgb(17, 24, 39))';

/** The readability scrim laid over the artwork. Deliberately translucent. */
const ARTWORK_SCRIM = 'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6))';

/** Fixed, full-bleed, above the global layout background (which is z-0). */
const BASE_STYLE = {
  position: 'fixed' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 1,
};

/**
 * How far the blurred artwork layer is grown past the viewport on every side.
 *
 * `filter: blur(4px)` does not only blur the layer's contents — it fades the
 * layer's own alpha at its boundary, because the kernel averages the edge pixels
 * with the transparent nothing outside the element box. A layer pinned to
 * `inset: 0` is therefore see-through in a band around the whole screen no
 * matter how opaque its background is, and the rocket wallpaper bleeds through
 * there. Measured at 1280x800: 2891 leaking pixels with the opaque base already
 * in place. Growing the box past the viewport puts the faded band off-screen.
 *
 * A Gaussian blur is effectively finished at 3x its radius; 16px gives 4x.
 */
const BLUR_BLEED_PX = 16;

/**
 * Build the style object for the full-bleed page background.
 *
 * @param artworkUrl - The resolved, display-ready artwork URL, or null/undefined
 *   when there is no artwork (or before the client has resolved one). Callers pass
 *   null during SSR and until `isClient` is true.
 */
export function buildPageBackgroundStyle(
  artworkUrl: string | null | undefined
): CSSProperties {
  if (!artworkUrl) {
    return { ...BASE_STYLE, background: PAGE_BACKGROUND_BASE };
  }

  return {
    ...BASE_STYLE,
    // Grown past the viewport so the blur's faded edge band lands off-screen.
    top: -BLUR_BLEED_PX,
    left: -BLUR_BLEED_PX,
    right: -BLUR_BLEED_PX,
    bottom: -BLUR_BLEED_PX,
    // Front to back: scrim, artwork, opaque base. The base is what stops the
    // global rocket wallpaper showing through while the artwork loads.
    backgroundImage: `${ARTWORK_SCRIM}, url('${artworkUrl}'), ${PAGE_BACKGROUND_BASE}`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    // Image rendering optimisations for better quality on upscaled artwork.
    filter: 'blur(4px) contrast(0.9) brightness(0.95)',
    imageRendering: 'high-quality' as any,
    WebkitBackfaceVisibility: 'hidden' as any,
    transform: 'translateZ(0)' as any,
  };
}
