/**
 * Whether a favorite is filed as a track or an album must be a property of the
 * ITEM, never of the screen you tapped it on.
 *
 * `FavoriteButton` decides that from one thing: `const isTrack =
 * !!(singleTrackData?.id || trackId)`. So a call site that omits
 * `singleTrackData` writes an album favorite while one that passes it writes a
 * track favorite — for the same release. That is exactly what happened: the
 * home list rows passed `feedId` alone, `AlbumCard` and the album page passed
 * track data for a one-track release, and a single favorited from the "New"
 * tab then read as unfavorited on its own album page. The row was never lost;
 * it was under the other kind.
 *
 * Both id chains had drifted too — `AlbumCard` carried a `track.id` rung the
 * album page lacked, so a track with neither guid nor url resolved to a
 * different key on each surface.
 *
 * Same failure family as `generateAlbumHref`: a value derived independently in
 * N places, so N places disagree. Derive it here instead, and pass the result
 * at every call site that renders an album-level heart.
 */

interface FavoriteTrackLike {
  id?: string;
  guid?: string | null;
  url?: string | null;
  title?: string | null;
}

interface FavoriteAlbumLike {
  feedId?: string;
  artist?: string | null;
  tracks?: FavoriteTrackLike[] | null;
}

export interface SingleTrackFavoriteData {
  id: string;
  title?: string;
  artist?: string;
}

/**
 * The `singleTrackData` for an album-level heart, or `undefined` when the
 * album should be favorited as an album.
 *
 * Returns `undefined` when the album has anything other than exactly one
 * track — including when `tracks` is absent, since a surface that didn't load
 * them cannot tell a single from a ten-track record and must not guess.
 */
export function singleTrackFavoriteData(
  album: FavoriteAlbumLike | null | undefined
): SingleTrackFavoriteData | undefined {
  if (!album?.tracks || album.tracks.length !== 1) return undefined;

  const track = album.tracks[0];
  if (!track) return undefined;

  // Order matters and must stay identical everywhere: guid is the portable
  // identifier, url is stable per release, and the composite is a last resort
  // that changes if the title is ever re-parsed.
  const id =
    track.guid ||
    track.url ||
    track.id ||
    (album.feedId && track.title ? `${album.feedId}-${track.title}` : undefined);
  if (!id) return undefined;

  return {
    id,
    title: track.title ?? undefined,
    artist: album.artist ?? undefined,
  };
}
