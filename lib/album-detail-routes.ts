/**
 * Routes that render `app/album/[id]/AlbumDetailClient.tsx`.
 *
 * That page pins a kebab to the right edge of every track row and carries its own
 * Share control in the album action row, so the app's floating buttons
 * (`BackToTop`, `ShareLinkButton`) must hide themselves here — otherwise they land
 * on top of one row's controls.
 *
 * Kept in one place because the predicate was previously copy-pasted into both
 * components, and a copy-paste is exactly how `/sandbox/album` got missed.
 */
export function isAlbumDetailRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === '/sandbox/album' ||
    pathname.startsWith('/sandbox/album/') ||
    pathname.startsWith('/album/') ||
    pathname.startsWith('/podcast/')
  );
}
