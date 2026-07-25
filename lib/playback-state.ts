/**
 * Persisted playback session — "resume where you left off".
 *
 * Pure and dependency-free on purpose (type-only imports are erased at build
 * time), so these helpers can be unit-tested with `npx tsx --test
 * lib/playback-state.test.ts` without a browser or a React tree. All DOM and
 * storage access lives in the consumer (`contexts/AudioContext.tsx`), mirroring
 * the split used by `lib/android-battery-hint.ts`.
 *
 * Two records, deliberately separate:
 *   - PLAYBACK_STATE_KEY    the *identity* (which album/playlist, which track).
 *                           Written only when the track changes.
 *   - PLAYBACK_POSITION_KEY the *position*. Written on a throttle, so the
 *                           large album payload isn't rewritten several times
 *                           a second just because `currentTime` ticked.
 *
 * Restoring identity is the feature; restoring the exact second is best-effort.
 */

import type { RSSAlbum, RSSTrack } from './rss-parser/types';

export const PLAYBACK_STATE_KEY = 'audioPlayerState';
export const PLAYBACK_POSITION_KEY = 'audioPlayerPosition';

/**
 * Bump to invalidate every persisted session. The consumer deletes any record
 * whose version doesn't match, so a shape change needs no migration code.
 *
 * v2 -> v3: track URLs are stored as `url` (v2 wrote `audioUrl`, which
 * `playAlbum` does not read, making v2 records unplayable); the track
 * projection carries `artist`/`mediaType`/`chaptersUrl`; album-level V4V is
 * kept; shuffle state is no longer persisted at all.
 */
export const AUDIO_STATE_VERSION = 3;

/** Below this many seconds played, resume from the track's natural start. */
export const MIN_RESUME_SECONDS = 5;

/** Within this many seconds of the end, treat the track as finished. */
export const TAIL_SECONDS = 15;

/** Sessions older than this are dropped rather than resurrected. */
export const DEFAULT_MAX_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface PersistedTrack {
  id?: string;
  title: string;
  /**
   * The playable URL. Named `url` to match `RSSTrack.url`, which is what
   * `playAlbum` reads — v2 wrote this as `audioUrl` and the mismatch made every
   * persisted session silently unplayable.
   */
  url?: string;
  artist?: string;
  duration?: string;
  image?: string;
  guid?: string;
  startTime?: number;
  endTime?: number;
  mediaType?: 'audio' | 'video';
  chaptersUrl?: string;
  v4vRecipient?: string;
  v4vValue?: any;
  /** Heavy fields — kept for the current track only. See serializeAlbumForPersistence. */
  chapters?: any[];
  valueTimeSplits?: any[];
}

export interface PersistedAlbum {
  title: string;
  artist: string;
  coverArt: string | null;
  id?: string;
  feedId?: string;
  feedUrl?: string;
  feedGuid?: string;
  v4vRecipient?: string;
  v4vValue?: any;
  tracks: PersistedTrack[];
}

export interface PersistedSession {
  version: number;
  album: PersistedAlbum;
  currentTrackIndex: number;
  timestamp: number;
}

export interface PersistedPosition {
  albumKey: string;
  trackIndex: number;
  position: number;
  duration: number;
  timestamp: number;
}

/**
 * Stable identity for an album/playlist, used to confirm that a position
 * record belongs to the session record it's being applied to. Falls back
 * through the id fields because playlists synthesize an album with no `id`.
 */
export function albumSessionKey(
  album: Pick<RSSAlbum, 'title'> & Partial<Pick<RSSAlbum, 'id' | 'feedId' | 'feedGuid' | 'artist'>>
): string {
  if (album.id) return `id:${album.id}`;
  if (album.feedId) return `feed:${album.feedId}`;
  if (album.feedGuid) return `guid:${album.feedGuid}`;
  return `title:${album.title}|${album.artist ?? ''}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Project an album down to what's needed to replay it later.
 *
 * Light fields are kept for every track so the player can advance through the
 * album offline. The heavy ones (`chapters`, `valueTimeSplits`) are kept for
 * `currentTrackIndex` only: a VTS podcast can carry ~30 segments per episode
 * across ~100 episodes, and the whole record has to fit in one storage value —
 * `lib/indexed-db-storage.ts` responds to a quota overflow by truncating
 * `tracks` to the first 100, which would silently corrupt a long album.
 *
 * Consequence worth knowing: after a resume, advancing to the *next* track
 * yields a track with no VTS data until the album is reopened from its own
 * page. Chapters still work, because `chaptersUrl` is kept for every track.
 */
export function serializeAlbumForPersistence(
  album: RSSAlbum,
  currentTrackIndex: number
): PersistedAlbum {
  const tracks = Array.isArray(album.tracks) ? album.tracks : [];

  return {
    title: album.title,
    artist: album.artist,
    coverArt: album.coverArt ?? null,
    id: album.id,
    feedId: album.feedId,
    feedUrl: album.feedUrl,
    feedGuid: album.feedGuid,
    // Album-level V4V: `triggerAutoBoost` falls back to these when a track has
    // none, and many feeds only declare <podcast:value> at the channel level.
    // Without them, boosting a resumed track pays the wrong recipients.
    v4vRecipient: album.v4vRecipient,
    v4vValue: album.v4vValue,
    tracks: tracks.map((track, index) => {
      const persisted: PersistedTrack = {
        id: track.id,
        title: track.title,
        url: track.url,
        artist: track.artist,
        duration: track.duration,
        image: track.image,
        guid: track.guid,
        startTime: track.startTime,
        endTime: track.endTime,
        mediaType: track.mediaType,
        chaptersUrl: track.chaptersUrl,
        v4vRecipient: track.v4vRecipient,
        v4vValue: track.v4vValue,
      };

      if (index === currentTrackIndex) {
        if (track.chapters) persisted.chapters = track.chapters;
        if (track.valueTimeSplits) persisted.valueTimeSplits = track.valueTimeSplits;
      }

      return persisted;
    }),
  };
}

/**
 * Inverse of {@link serializeAlbumForPersistence}. Takes `unknown` on purpose —
 * this is the one place that has to survive v2-shaped records, hand-edited
 * storage, and anything else that turns up in IndexedDB.
 *
 * Returns null when there is nothing playable, so the caller can drop the
 * record rather than restore a player bar that can't start.
 */
export function rehydrateAlbum(saved: unknown): RSSAlbum | null {
  if (!saved || typeof saved !== 'object') return null;

  const raw = saved as Record<string, any>;
  if (!isNonEmptyString(raw.title)) return null;
  if (!Array.isArray(raw.tracks) || raw.tracks.length === 0) return null;

  const tracks: RSSTrack[] = raw.tracks
    .filter((track: unknown): track is Record<string, any> => !!track && typeof track === 'object')
    .map((track: Record<string, any>) => {
      // v2 stored the playable URL under `audioUrl`; v3 uses `url`.
      const url = isNonEmptyString(track.url)
        ? track.url
        : isNonEmptyString(track.audioUrl)
          ? track.audioUrl
          : undefined;

      const rehydrated: RSSTrack = {
        id: track.id,
        title: isNonEmptyString(track.title) ? track.title : 'Unknown Track',
        // RSSTrack requires `duration`; persisted records may predate it.
        duration: typeof track.duration === 'string' ? track.duration : '0:00',
        url,
        artist: track.artist,
        image: track.image,
        guid: track.guid,
        startTime: typeof track.startTime === 'number' ? track.startTime : undefined,
        endTime: typeof track.endTime === 'number' ? track.endTime : undefined,
        mediaType: track.mediaType === 'video' ? 'video' : track.mediaType === 'audio' ? 'audio' : undefined,
        chaptersUrl: track.chaptersUrl,
        v4vRecipient: track.v4vRecipient,
        v4vValue: track.v4vValue,
      };

      if (Array.isArray(track.chapters)) rehydrated.chapters = track.chapters;
      if (Array.isArray(track.valueTimeSplits)) rehydrated.valueTimeSplits = track.valueTimeSplits;

      return rehydrated;
    });

  // A session with no playable track can't be resumed at all.
  if (!tracks.some((track) => isNonEmptyString(track.url))) return null;

  return {
    title: raw.title,
    artist: isNonEmptyString(raw.artist) ? raw.artist : 'Unknown Artist',
    coverArt: isNonEmptyString(raw.coverArt) ? raw.coverArt : null,
    // Required by RSSAlbum but never persisted — not worth the bytes.
    description: '',
    releaseDate: '',
    id: raw.id,
    feedId: raw.feedId,
    feedUrl: raw.feedUrl,
    feedGuid: raw.feedGuid,
    v4vRecipient: raw.v4vRecipient,
    v4vValue: raw.v4vValue,
    tracks,
  };
}

/**
 * Where playback should actually start, given a saved position.
 *
 * Returns null to mean "start this track where it would naturally start" —
 * either because barely any of it was played, or because it was effectively
 * finished and resuming would drop the user into the outro.
 */
export function resolveResumePosition(input: {
  position: number;
  duration?: number;
  startTime?: number;
  endTime?: number;
}): number | null {
  const { position, duration, startTime, endTime } = input;

  if (typeof position !== 'number' || !Number.isFinite(position)) return null;

  const hasSegment = typeof startTime === 'number' && Number.isFinite(startTime);
  const segmentStart = hasSegment ? startTime! : 0;

  // Not enough listened to be worth restoring — measured from the track's own
  // start, so a VTS segment beginning at 900s isn't treated as 900s played.
  if (position - segmentStart < MIN_RESUME_SECONDS) return null;

  // Effective end: the segment's end if this is a time-segment track,
  // otherwise the media duration when we know it.
  const hasEnd = typeof endTime === 'number' && Number.isFinite(endTime);
  const hasDuration = typeof duration === 'number' && Number.isFinite(duration) && duration > 0;
  const effectiveEnd = hasEnd ? endTime! : hasDuration ? duration! : null;

  if (effectiveEnd !== null) {
    if (position > effectiveEnd - TAIL_SECONDS) return null;
    // Never hand back a position past the playable range.
    return Math.max(segmentStart, Math.min(position, effectiveEnd - TAIL_SECONDS));
  }

  return Math.max(segmentStart, position);
}

/** Guards against a months-old session reappearing as if it were current. */
export function isSessionFresh(input: {
  timestamp: number;
  now: number;
  maxAgeMs?: number;
}): boolean {
  const { timestamp, now, maxAgeMs = DEFAULT_MAX_SESSION_AGE_MS } = input;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return false;
  const age = now - timestamp;
  // A clock skew that puts the record in the future is still "fresh".
  if (age < 0) return true;
  return age <= maxAgeMs;
}
