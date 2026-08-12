import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SHOW_PREFIX, ITEM_PREFIX } from '@/lib/nostr/shared-favorites';

/**
 * Inbound half of the cross-app favorites sync (docs/pc20-favorites.md).
 *
 * The client reads the shared kind:30003 list off relays — it holds the signer
 * and the relay connections — and POSTs the resolved identifiers here. This
 * route maps them onto DB rows and reconciles.
 *
 * RECONCILIATION DELETES ROWS, so the guards below are the whole design:
 *
 *   - `trustworthy` must be explicitly true. A degraded relay read looks
 *     exactly like an empty list, and acting on it wipes the user's favorites.
 *     The client already refuses to send otherwise; this is the second lock.
 *   - `userId` only, never `sessionId`. An anonymous session has no Nostr
 *     identity, so it has no shared list to be reconciled against.
 *   - Only favorites that COULD have appeared on the list are eligible for
 *     deletion: album/track rows whose Feed/Track carries a guid. A favorite
 *     with no portable identifier can never be missing from the wire, and
 *     publishers and playlists are out of scope entirely (synthetic ids, no
 *     external identifier). Those rows are never touched.
 */

interface SharedShow {
  feedGuid: string;
  feedUrl?: string;
}

interface SharedTrack {
  itemGuid: string;
  feedGuid?: string;
  feedUrl?: string;
}

// Out of scope for the shared list — StableKraft-local constructs with no
// portable identifier. Never published, and never reconciled away.
const UNSYNCED_FAVORITE_TYPES = new Set(['publisher', 'playlist']);

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-nostr-user-id');
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Shared favorites sync requires a Nostr user' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const trustworthy = body?.trustworthy === true;
    const shows: SharedShow[] = Array.isArray(body?.shows) ? body.shows : [];
    const tracks: SharedTrack[] = Array.isArray(body?.tracks) ? body.tracks : [];
    // The ids this device last agreed with the relay on. A removal is
    // `baseline − incoming`, NEVER `everything in the DB − incoming`: on the
    // very first run the shared list is empty because nothing has published to
    // it yet, and the wider rule would read that as "the user cleared
    // everything" and delete their entire library. An absent baseline means
    // this device has never agreed to anything, so it may not delete at all.
    const baseline: string[] = Array.isArray(body?.baseline) ? body.baseline : [];
    const baselineFeedGuids = new Set(
      baseline.filter((id) => id.startsWith(SHOW_PREFIX)).map((id) => id.slice(SHOW_PREFIX.length))
    );
    const baselineItemGuids = new Set(
      baseline.filter((id) => id.startsWith(ITEM_PREFIX)).map((id) => id.slice(ITEM_PREFIX.length))
    );

    if (!trustworthy) {
      return NextResponse.json(
        { success: false, error: 'Refusing to reconcile against an untrusted relay read' },
        { status: 400 }
      );
    }

    const wantedFeedGuids = [...new Set(shows.map((s) => s.feedGuid).filter(Boolean))];
    const wantedItemGuids = [...new Set(tracks.map((t) => t.itemGuid).filter(Boolean))];

    // --- resolve incoming identifiers to local rows -------------------------
    const [matchedFeeds, matchedTracks] = await Promise.all([
      wantedFeedGuids.length
        ? prisma.feed.findMany({
            where: { guid: { in: wantedFeedGuids } },
            select: { id: true, guid: true },
          })
        : Promise.resolve([]),
      wantedItemGuids.length
        ? prisma.track.findMany({
            where: { guid: { in: wantedItemGuids } },
            select: { id: true, guid: true },
          })
        : Promise.resolve([]),
    ]);

    const feedIdByGuid = new Map(matchedFeeds.map((f) => [f.guid as string, f.id]));
    const trackIdByGuid = new Map(matchedTracks.map((t) => [t.guid as string, t.id]));

    // Feed guids we've never seen. Returned so the client can hand them to the
    // existing PI import path rather than silently losing the favorite.
    const unresolvedFeedGuids = wantedFeedGuids.filter((g) => !feedIdByGuid.has(g));
    const unresolvedItemGuids = wantedItemGuids.filter((g) => !trackIdByGuid.has(g));

    // --- what this user already has ----------------------------------------
    const [existingAlbums, existingTracks] = await Promise.all([
      prisma.favoriteAlbum.findMany({
        where: { userId },
        select: { id: true, feedId: true, type: true },
      }),
      prisma.favoriteTrack.findMany({
        where: { userId },
        select: { id: true, trackId: true },
      }),
    ]);

    // --- add what the list has and the DB doesn't --------------------------
    const existingAlbumFeedIds = new Set(existingAlbums.map((f) => f.feedId));
    const addedAlbums: string[] = [];
    for (const [, feedId] of feedIdByGuid) {
      if (existingAlbumFeedIds.has(feedId)) continue;
      try {
        await prisma.favoriteAlbum.create({
          data: { userId, feedId, type: 'album' },
        });
        addedAlbums.push(feedId);
      } catch {
        // Unique-constraint race with a concurrent favorite — already there.
      }
    }

    const existingTrackIds = new Set(existingTracks.map((f) => f.trackId));
    const addedTracks: string[] = [];
    for (const [guid, trackId] of trackIdByGuid) {
      // A FavoriteTrack.trackId is polymorphic (Track.id | Track.guid |
      // audioUrl), so an existing row may hold either form of the same track.
      if (existingTrackIds.has(trackId) || existingTrackIds.has(guid)) continue;
      try {
        await prisma.favoriteTrack.create({ data: { userId, trackId } });
        addedTracks.push(trackId);
      } catch {
        // Unique-constraint race — already there.
      }
    }

    // --- remove what the DB has and the list doesn't -----------------------
    //
    // Resolve every existing favorite to its guid first. A row we cannot map to
    // a guid is not on the wire and is therefore NOT a candidate for deletion —
    // that is the difference between "the user unfavorited it elsewhere" and
    // "this app can't represent it".
    const removedAlbums: string[] = [];
    const eligibleAlbums = existingAlbums.filter(
      (f) => !UNSYNCED_FAVORITE_TYPES.has(f.type || 'album')
    );
    if (eligibleAlbums.length) {
      const ids = eligibleAlbums.map((f) => f.feedId);
      // feedId is polymorphic too — match by primary key and by guid column.
      const feeds = await prisma.feed.findMany({
        where: { OR: [{ id: { in: ids } }, { guid: { in: ids } }] },
        select: { id: true, guid: true },
      });
      const guidByFeedRef = new Map<string, string | null>();
      for (const feed of feeds) {
        guidByFeedRef.set(feed.id, feed.guid);
        if (feed.guid) guidByFeedRef.set(feed.guid, feed.guid);
      }
      const wantedFeedGuidSet = new Set(wantedFeedGuids);
      const doomed = eligibleAlbums.filter((fav) => {
        const guid = guidByFeedRef.get(fav.feedId);
        if (!guid) return false; // not representable ⇒ never reconciled away
        if (!baselineFeedGuids.has(guid)) return false; // never agreed ⇒ not ours to delete
        return !wantedFeedGuidSet.has(guid);
      });
      if (doomed.length) {
        await prisma.favoriteAlbum.deleteMany({
          where: { id: { in: doomed.map((d) => d.id) } },
        });
        removedAlbums.push(...doomed.map((d) => d.feedId));
      }
    }

    const removedTracks: string[] = [];
    if (existingTracks.length) {
      const refs = existingTracks.map((f) => f.trackId);
      const trackRows = await prisma.track.findMany({
        where: { OR: [{ id: { in: refs } }, { guid: { in: refs } }] },
        select: { id: true, guid: true },
      });
      const guidByTrackRef = new Map<string, string | null>();
      for (const track of trackRows) {
        guidByTrackRef.set(track.id, track.guid);
        if (track.guid) guidByTrackRef.set(track.guid, track.guid);
      }
      const wantedItemGuidSet = new Set(wantedItemGuids);
      const doomed = existingTracks.filter((fav) => {
        const guid = guidByTrackRef.get(fav.trackId);
        if (!guid) return false; // audioUrl-keyed or unknown ⇒ not on the wire
        if (!baselineItemGuids.has(guid)) return false; // never agreed ⇒ not ours to delete
        return !wantedItemGuidSet.has(guid);
      });
      if (doomed.length) {
        await prisma.favoriteTrack.deleteMany({
          where: { id: { in: doomed.map((d) => d.id) } },
        });
        removedTracks.push(...doomed.map((d) => d.trackId));
      }
    }

    // Import feeds the list references and we've never seen, so the favorite
    // resolves on a later pull rather than being lost. Fire-and-forget and
    // capped: the list is user-controlled in size and each import is a PI call.
    if (unresolvedFeedGuids.length) {
      import('@/lib/feed-discovery')
        .then(({ addUnresolvedFeeds }) => addUnresolvedFeeds(unresolvedFeedGuids.slice(0, 10)))
        .catch((e) => console.warn('⚠️ Shared favorites: feed import failed:', e));
    }

    // Favorites this app holds that aren't on the shared list yet. The client
    // uses this to decide whether to push — on first run it is the user's whole
    // library, which is exactly what needs to go up.
    const localOnly =
      matchedFeeds.length + matchedTracks.length <
      existingAlbums.filter((f) => !UNSYNCED_FAVORITE_TYPES.has(f.type || 'album')).length +
        existingTracks.length;

    return NextResponse.json({
      success: true,
      localOnly,
      added: { albums: addedAlbums.length, tracks: addedTracks.length },
      removed: { albums: removedAlbums.length, tracks: removedTracks.length },
      unresolved: { feedGuids: unresolvedFeedGuids, itemGuids: unresolvedItemGuids },
    });
  } catch (error) {
    console.error('Error reconciling shared favorites:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
