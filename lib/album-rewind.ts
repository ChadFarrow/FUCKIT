/**
 * Where an album rewinds to when it finishes with repeat off.
 *
 * `playNextTrack`'s end-of-album branch used to hard-code index 0, while its
 * repeat-all sibling correctly scanned for the first *available* track. On an
 * album whose opening track is unavailable that parked the UI on a track that
 * could never play. Both branches now share this rule.
 *
 * The availability test mirrors the one used throughout AudioContext's advance
 * logic: a track with no `status` is assumed playable, and only an explicit
 * status other than 'active' marks it unavailable.
 */
export function isTrackAvailable(track: { status?: string } | undefined | null): boolean {
  if (!track) return false;
  return !track.status || track.status === 'active';
}

/**
 * Index to rewind to, or null when the album has no playable track at all —
 * in which case the caller must stop rather than cue anything.
 */
export function resolveAlbumRewindIndex(
  tracks: ReadonlyArray<{ status?: string }> | undefined | null
): number | null {
  if (!tracks || tracks.length === 0) return null;

  for (let i = 0; i < tracks.length; i++) {
    if (isTrackAvailable(tracks[i])) return i;
  }

  return null;
}
