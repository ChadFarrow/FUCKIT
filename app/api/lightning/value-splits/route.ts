import { NextRequest, NextResponse } from 'next/server';
import { createErrorLogger } from '@/lib/error-utils';
import { prisma } from '@/lib/prisma';
import { podcastIndexAPI } from '@/lib/podcast-index-api';

const logger = createErrorLogger('ValueSplitsAPI');

/** Detect recipient type from address format rather than trusting stored metadata */
function detectRecipientType(address: string): 'node' | 'lnaddress' {
  if (address.includes('@')) return 'lnaddress';
  if (/^[0-9a-fA-F]{66}$/.test(address)) return 'node';
  return 'node';
}

/** Map raw V4V recipients to a normalized response format */
function mapRecipients(recipients: any[], fallbackName: string) {
  return recipients.map((r: any) => ({
    name: r.name || fallbackName,
    type: detectRecipientType(r.address || ''),
    address: r.address || '',
    split: parseInt(r.split) || 100,
    fee: false,
    // Routing TLV — the receiving node needs this to know which account to credit, and it is
    // what identifies a Fountain recipient published as a plain node entry.
    customKey: r.customKey ?? undefined,
    customValue: r.customValue ?? undefined
  }));
}

function successResponse(recipients: any[], artistName: string) {
  return NextResponse.json({
    success: true,
    data: { type: 'lightning', method: 'keysend', recipients },
    artistName
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const feedGuid = searchParams.get('feedGuid');
    const itemGuid = searchParams.get('itemGuid');
    const trackId = searchParams.get('trackId');
    const chapterTitle = searchParams.get('chapterTitle');

    logger.info('Fetching value splits', { feedGuid, itemGuid, trackId });

    let matchingFeed: any = null;
    let matchingTrack: any = null;

    // First try to find by specific track if itemGuid provided
    if (itemGuid) {
      // If feedGuid provided, find track in that specific feed first
      if (feedGuid) {
        const feed = await prisma.feed.findFirst({
          where: { OR: [{ guid: feedGuid }, { id: feedGuid }] }
        });
        if (feed) {
          matchingTrack = await prisma.track.findFirst({
            where: { guid: itemGuid, feedId: feed.id },
            include: { Feed: true }
          });

          // Validate against chapter title to detect GUID collisions
          // Chapter titles are typically "Track Title by Artist"
          if (matchingTrack && chapterTitle) {
            const trackTitle = (matchingTrack.title || '').toLowerCase();
            const feedArtist = (matchingTrack.Feed?.artist || '').toLowerCase();
            const chapter = chapterTitle.toLowerCase();
            // If neither the track title nor feed artist appear in the chapter title,
            // this is likely a GUID collision — discard the match
            if (trackTitle && !chapter.includes(trackTitle.substring(0, 10)) &&
                feedArtist && !chapter.includes(feedArtist.substring(0, 6))) {
              logger.warn('GUID collision detected — DB match does not match chapter context', {
                dbTrack: matchingTrack.title,
                dbArtist: matchingTrack.Feed?.artist,
                chapterTitle
              });
              matchingTrack = null;
            }
          }
        }
      }
      // Fallback: find by itemGuid alone (only if no feedGuid was provided,
      // otherwise we'd risk matching a different track in a different feed)
      if (!matchingTrack && !feedGuid) {
        matchingTrack = await prisma.track.findFirst({
          where: { guid: itemGuid },
          include: { Feed: true }
        });
      }

      if (matchingTrack) {
        matchingFeed = matchingTrack.Feed;

        // Check if track has its own V4V data
        if (matchingTrack.v4vValue) {
          try {
            const trackV4V = typeof matchingTrack.v4vValue === 'string'
              ? JSON.parse(matchingTrack.v4vValue)
              : matchingTrack.v4vValue;
            if (trackV4V.recipients?.length > 0) {
              const fallbackName = matchingFeed?.artist || 'Unknown';
              const recipients = mapRecipients(trackV4V.recipients, fallbackName);
              logger.info('Found track-specific value splits', { itemGuid, recipientsCount: recipients.length });
              return successResponse(recipients, matchingTrack?.artist || fallbackName);
            }
          } catch (parseError) {
            logger.warn('Failed to parse track V4V data', { itemGuid, error: parseError });
          }
        }
      }
    }

    // Find feed by feedGuid or trackId
    if (!matchingFeed) {
      if (feedGuid) {
        matchingFeed = await prisma.feed.findFirst({
          where: { id: feedGuid }
        });
      }

      // If no feedGuid provided, try to find by trackId pattern
      if (!matchingFeed && trackId) {
        const trackIdParts = trackId.split('-');
        if (trackIdParts.length >= 2) {
          const possibleFeedGuid = trackIdParts[1];
          matchingFeed = await prisma.feed.findFirst({
            where: { id: possibleFeedGuid }
          });
        }
      }
    }

    // Check if feed has V4V data
    if (matchingFeed?.v4vValue) {
      try {
        const feedV4V = typeof matchingFeed.v4vValue === 'string'
          ? JSON.parse(matchingFeed.v4vValue)
          : matchingFeed.v4vValue;
        if (feedV4V.recipients?.length > 0) {
          const fallbackName = matchingFeed.artist || 'Unknown';
          const recipients = mapRecipients(feedV4V.recipients, fallbackName);
          logger.info('Found feed-level value splits', { feedGuid: matchingFeed.id, recipientsCount: recipients.length });
          return successResponse(recipients, matchingTrack?.artist || fallbackName);
        }
      } catch (parseError) {
        logger.warn('Failed to parse feed V4V data', { feedGuid: matchingFeed.id, error: parseError });
      }
    }

    // Check for simple lightning address fallback
    const lightningAddress = matchingTrack?.v4vRecipient || matchingFeed?.v4vRecipient;
    if (lightningAddress) {
      const recipients = [{
        name: matchingFeed?.artist || 'Unknown Artist',
        type: detectRecipientType(lightningAddress),
        address: lightningAddress,
        split: 100,
        fee: false
      }];
      logger.info('Found lightning address fallback', { lightningAddress, feedGuid: matchingFeed?.id });
      return successResponse(recipients, matchingTrack?.artist || matchingFeed?.artist);
    }

    // Fallback: try Podcast Index API for feeds/tracks not in our DB
    if (feedGuid && itemGuid) {
      try {
        const episode = await podcastIndexAPI.getEpisodeByGuid(feedGuid, itemGuid);
        if (episode && episode.value?.destinations?.length > 0) {
          const fallbackName = episode.feedTitle || 'Unknown';
          const recipients = mapRecipients(episode.value.destinations, fallbackName);
          logger.info('Found value splits via Podcast Index API', { feedGuid, itemGuid, recipientsCount: recipients.length });
          return successResponse(recipients, episode.feedTitle || fallbackName);
        }
      } catch (piError) {
        logger.warn('Podcast Index API fallback failed', { feedGuid, itemGuid, error: (piError as Error).message });
      }
    }

    logger.info('No value splits found', { feedGuid, itemGuid, trackId });
    return successResponse([], '');

  } catch (error) {
    logger.error('Error fetching value splits', { error: (error as Error).message });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
