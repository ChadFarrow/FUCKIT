import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyEvent, getEventHash } from 'nostr-tools';
import { getSessionIdFromRequest } from '@/lib/session-utils';
import { normalizePubkey } from '@/lib/nostr/normalize';
import { publicKeyToNpub } from '@/lib/nostr/keys';
import { sessionCookie } from '@/lib/auth/require-user';
import {
  verifyChallenge,
  isCreatedAtAcceptable,
  markChallengeUsed,
} from '@/lib/auth/challenge';

/**
 * POST /api/nostr/auth/login
 * Verifies a Nostr login event + syncs profile + ensures DB stores hex pubkeys.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      publicKey: rawPubkey,
      npub,
      challenge,
      signature,
      eventId,
      createdAt,
      kind,
      content
    } = body;

    if (!rawPubkey || !challenge || !signature || !eventId || !createdAt) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const hexPubkey = normalizePubkey(rawPubkey);

    if (!hexPubkey) {
      return NextResponse.json(
        { success: false, error: 'Invalid pubkey format (must be hex or npub)' },
        { status: 400 }
      );
    }

    // Replay protection. Verifying the signature proves the holder of the key
    // signed THIS event; it does not prove they signed it recently, or that the
    // challenge came from us. Without the two checks below, one captured login
    // body minted a fresh 90-day proven session forever.
    //
    // FAIL-OPEN when SESSION_SECRET is unset, matching the challenge route and
    // lib/auth/require-user.ts — an unsigned challenge cannot be verified, and
    // a hard failure here would lock everyone out of an unconfigured deploy.
    const sessionSecret = process.env.SESSION_SECRET;
    if (sessionSecret) {
      const nowMs = Date.now();

      const challengeCheck = verifyChallenge(challenge, sessionSecret, nowMs);
      if (!challengeCheck.ok) {
        console.warn(`⚠️ Login rejected: challenge ${challengeCheck.reason}`);
        return NextResponse.json(
          { success: false, error: 'Challenge expired or invalid — please try again' },
          { status: 401 }
        );
      }

      if (!isCreatedAtAcceptable(Number(createdAt), nowMs)) {
        console.warn('⚠️ Login rejected: created_at outside the accepted window');
        return NextResponse.json(
          { success: false, error: 'Login event timestamp is out of range' },
          { status: 401 }
        );
      }

      // Best-effort single use. Per-instance, so the TTL above is the real
      // guarantee; this closes automated same-instance replay.
      if (!markChallengeUsed(challengeCheck.nonce, nowMs)) {
        console.warn('⚠️ Login rejected: challenge already redeemed');
        return NextResponse.json(
          { success: false, error: 'Challenge already used — please try again' },
          { status: 401 }
        );
      }
    }

    let calculatedNpub = npub;
    if (!calculatedNpub || calculatedNpub.trim() === '') {
      try {
        calculatedNpub = publicKeyToNpub(hexPubkey);
      } catch (err) {
        return NextResponse.json(
          { success: false, error: 'Failed to derive npub' },
          { status: 400 }
        );
      }
    }

    const eventKind = kind ?? 1;
    const eventContent = content ?? 'Authentication challenge';

    const eventTemplate = {
      kind: eventKind,
      tags: [['challenge', challenge]],
      content: eventContent,
      created_at: createdAt,
      pubkey: hexPubkey,
    };

    const expectedEventId = getEventHash(eventTemplate);

    if (expectedEventId !== eventId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid event ID — mismatch with reconstructed event'
        },
        { status: 401 }
      );
    }

    const event = {
      ...eventTemplate,
      id: eventId,
      sig: signature,
    };

    if (!verifyEvent(event)) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Profile fields are set to null here — the client already backfills
    // profile data via NostrContext after redirect, so the relay round-trip
    // that used to happen here (~21s) is unnecessary.
    const displayName = null;
    const avatar = null;
    const bio = null;
    const lightningAddress = null;
    const relayList: string[] | null = null;

    let user = await prisma.user.findUnique({
      where: { nostrPubkey: hexPubkey },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: hexPubkey, // Use pubkey as ID since it's unique
          nostrPubkey: hexPubkey,
          nostrNpub: calculatedNpub,
          displayName,
          avatar,
          bio,
          lightningAddress,
          relays: relayList || [],
          updatedAt: new Date(),
        },
      });
    } else {
      // Only update nostrNpub — don't overwrite existing profile data with nulls.
      // Profile data will be backfilled from Nostr relays by NostrContext.refreshUser().
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          nostrNpub: calculatedNpub,
          ...(relayList ? { relays: relayList } : {}),
        },
      });
    }

    const sessionId = getSessionIdFromRequest(request);

    if (sessionId) {
      try {
        // Migrate session tracks to user (batch operations to fix N+1)
        const sessionTracks = await prisma.favoriteTrack.findMany({
          where: { sessionId, userId: null },
        });

        if (sessionTracks.length > 0) {
          // Get all existing user tracks in one query
          const existingUserTracks = await prisma.favoriteTrack.findMany({
            where: {
              userId: user.id,
              trackId: { in: sessionTracks.map(t => t.trackId) }
            },
            select: { trackId: true }
          });
          const existingTrackIds = new Set(existingUserTracks.map(t => t.trackId));

          // Separate into tracks to migrate vs duplicates to delete
          const toMigrate = sessionTracks.filter(t => !existingTrackIds.has(t.trackId));
          const toDelete = sessionTracks.filter(t => existingTrackIds.has(t.trackId));

          // Batch update tracks to migrate
          if (toMigrate.length > 0) {
            await prisma.favoriteTrack.updateMany({
              where: { id: { in: toMigrate.map(t => t.id) } },
              data: { userId: user.id, sessionId: null }
            });
          }

          // Batch delete duplicates
          if (toDelete.length > 0) {
            await prisma.favoriteTrack.deleteMany({
              where: { id: { in: toDelete.map(t => t.id) } }
            });
          }
        }

        // Migrate session albums to user (batch operations to fix N+1)
        const sessionAlbums = await prisma.favoriteAlbum.findMany({
          where: { sessionId, userId: null },
        });

        if (sessionAlbums.length > 0) {
          // Get all existing user albums in one query
          const existingUserAlbums = await prisma.favoriteAlbum.findMany({
            where: {
              userId: user.id,
              feedId: { in: sessionAlbums.map(a => a.feedId) }
            },
            select: { feedId: true }
          });
          const existingFeedIds = new Set(existingUserAlbums.map(a => a.feedId));

          // Separate into albums to migrate vs duplicates to delete
          const toMigrate = sessionAlbums.filter(a => !existingFeedIds.has(a.feedId));
          const toDelete = sessionAlbums.filter(a => existingFeedIds.has(a.feedId));

          // Batch update albums to migrate
          if (toMigrate.length > 0) {
            await prisma.favoriteAlbum.updateMany({
              where: { id: { in: toMigrate.map(a => a.id) } },
              data: { userId: user.id, sessionId: null }
            });
          }

          // Batch delete duplicates
          if (toDelete.length > 0) {
            await prisma.favoriteAlbum.deleteMany({
              where: { id: { in: toDelete.map(a => a.id) } }
            });
          }
        }
      } catch (err) {
        console.error('Favorite migration failed:', err);
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        nostrPubkey: user.nostrPubkey,
        nostrNpub: user.nostrNpub,
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio,
        lightningAddress: user.lightningAddress,
        relays: user.relays,
        loginType: 'extension',
      },
    });

    // This route verified a signed Nostr event above (getEventHash
    // reconstruction + verifyEvent), so the session is proven and may write.
    const cookie = sessionCookie(user.id, true);
    if (cookie) response.headers.set('Set-Cookie', cookie);

    return response;
  } catch (err: any) {
    console.error('Nostr login error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Login failed',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}