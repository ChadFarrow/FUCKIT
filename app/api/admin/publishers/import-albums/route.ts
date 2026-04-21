import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generatePodcastIndexHeaders } from '@/lib/podcast-index-api';
import { getEpisodesFromAPI, parseDuration } from '@/lib/feed-parsing';
import { calculateTrackOrder } from '@/lib/rss-parser-db';
import { generateAlbumSlug, normalizeUrl } from '@/lib/url-utils';
import { isAutoImportSuppressedUrl } from '@/lib/feed-exclusions';

const API_BASE_URL = 'https://api.podcastindex.org/api/1.0';

/**
 * Search Podcast Index API for music feeds by artist name
 */
async function searchMusicFeedsByArtist(artistName: string): Promise<any[]> {
  try {
    const headers = await generatePodcastIndexHeaders();
    const url = `${API_BASE_URL}/search/byterm?q=${encodeURIComponent(artistName)}`;
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.warn(`⚠️ PI search failed for "${artistName}": ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (data.status !== 'true' || !data.feeds) return [];

    // Filter to music medium feeds with exact author match (case insensitive)
    const searchLower = artistName.toLowerCase();
    return data.feeds.filter((feed: any) => {
      if (feed.medium !== 'music') return false;
      const author = (feed.author || '').toLowerCase();
      return author === searchLower;
    });
  } catch (error) {
    console.error(`❌ PI search error for "${artistName}":`, error);
    return [];
  }
}

function generateFeedId(artist: string | undefined, title: string): string {
  const parts = [];
  if (artist) parts.push(generateAlbumSlug(artist));
  parts.push(generateAlbumSlug(title));
  let baseId = parts.join('-');
  if (!baseId || baseId.length < 2) baseId = `feed-${Date.now()}`;
  return baseId;
}

/**
 * POST /api/admin/publishers/import-albums
 * Import missing album feeds using Podcast Index API search by artist name.
 * No direct Wavlake fetching — all lookups go through PI API.
 * Body: { publisherId?: string } - optional, if not provided imports for all publishers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { publisherId } = body;

    // Get publishers to process
    const publishers = await prisma.feed.findMany({
      where: {
        type: 'publisher',
        status: 'active',
        ...(publisherId ? { id: publisherId } : {})
      },
      select: {
        id: true,
        title: true,
        artist: true,
        originalUrl: true
      }
    });

    if (publishers.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No publishers found'
      }, { status: 404 });
    }

    console.log(`🚀 Processing ${publishers.length} publisher(s) for album import via PI API`);

    // Deduplicate PI API searches: multiple publishers may share the same artist name
    const searchedArtists = new Set<string>();

    const results: Array<{
      publisherId: string;
      title: string;
      piResults: number;
      imported: number;
      skipped: number;
      failed: number;
      errors: string[];
      skippedDetails: string[];
    }> = [];

    for (const publisher of publishers) {
      const result = {
        publisherId: publisher.id,
        title: publisher.title || publisher.id,
        piResults: 0,
        imported: 0,
        skipped: 0,
        failed: 0,
        errors: [] as string[],
        skippedDetails: [] as string[]
      };

      const artistName = publisher.artist || publisher.title;
      if (!artistName) {
        result.errors.push('No artist name');
        results.push(result);
        continue;
      }

      try {
        console.log(`\n📋 Processing: ${publisher.title} (artist: "${artistName}")`);

        // Deduplicate: skip PI search if we already searched this artist
        const artistKey = artistName.toLowerCase();
        let piFeeds: any[] = [];

        if (searchedArtists.has(artistKey)) {
          console.log(`   ⏭️ Already searched PI for "${artistName}", skipping search`);
        } else {
          searchedArtists.add(artistKey);
          piFeeds = await searchMusicFeedsByArtist(artistName);
          result.piResults = piFeeds.length;
          console.log(`   Found ${piFeeds.length} music feeds on PI for "${artistName}"`);
        }

        // Process each PI result
        for (const piFeed of piFeeds) {
          const feedUrl = normalizeUrl(piFeed.url || piFeed.originalUrl || '');
          const podcastGuid = piFeed.podcastGuid || '';

          try {
            // Skip URLs explicitly suppressed from auto-import (blacklist or
            // duplicate-source mirrors). Prevents the 4 AM cron from recreating
            // feed rows the user has intentionally deleted.
            if (feedUrl && isAutoImportSuppressedUrl(feedUrl)) {
              result.skippedDetails.push(`suppressed:${piFeed.title}|${feedUrl}`);
              result.skipped++;
              continue;
            }

            // Multi-check dedup: URL, podcastGuid as ID, podcastGuid as guid column
            const conditions: any[] = [];
            if (feedUrl) conditions.push({ originalUrl: feedUrl });
            if (podcastGuid) {
              conditions.push({ id: podcastGuid });
              conditions.push({ guid: podcastGuid });
            }

            if (conditions.length === 0) {
              result.skippedDetails.push(`no-identifiers:${piFeed.title}`);
              result.skipped++;
              continue;
            }

            const existing = await prisma.feed.findFirst({
              where: { OR: conditions }
            });

            if (existing) {
              console.log(`   ⏭️ Exists: ${existing.title} (${existing.id})`);
              result.skippedDetails.push(`exists:${existing.id}|${existing.title}|pubId:${existing.publisherId}`);
              if (!existing.publisherId) {
                await prisma.feed.update({
                  where: { id: existing.id },
                  data: { publisherId: publisher.id }
                });
                console.log(`   🔗 Linked to publisher: ${publisher.id}`);
              }
              result.skipped++;
              continue;
            }

            // Get episodes via PI API
            const episodes = await getEpisodesFromAPI(piFeed.id);
            if (!episodes || episodes.length === 0) {
              result.skippedDetails.push(`no-episodes:${piFeed.title}`);
              result.skipped++;
              continue;
            }

            // Generate feed ID
            let feedId = generateFeedId(piFeed.author, piFeed.title);
            const idExists = await prisma.feed.findUnique({ where: { id: feedId } });
            if (idExists) feedId = `${feedId}-${Date.now()}`;

            // Secondary dedup by podcastGuid
            if (podcastGuid) {
              const guidExists = await prisma.feed.findFirst({
                where: { guid: podcastGuid }
              });
              if (guidExists) {
                result.skippedDetails.push(`guid:${guidExists.id}|${guidExists.title}|pubId:${guidExists.publisherId}`);
                if (!guidExists.publisherId) {
                  await prisma.feed.update({
                    where: { id: guidExists.id },
                    data: { publisherId: publisher.id }
                  });
                }
                result.skipped++;
                continue;
              }
            }

            // Format feed-level v4v data from PI API
            let v4vValue = null;
            let v4vRecipient = null;
            if (piFeed.value?.model && piFeed.value?.destinations) {
              v4vValue = {
                type: piFeed.value.model.type || 'lightning',
                method: piFeed.value.model.method || 'keysend',
                suggested: piFeed.value.model.suggested,
                recipients: piFeed.value.destinations.map((r: any) => ({
                  name: r.name,
                  type: r.type,
                  address: r.address,
                  split: r.split,
                  customKey: r.customKey,
                  customValue: r.customValue,
                  fee: r.fee || false
                }))
              };
              v4vRecipient = piFeed.value.destinations[0]?.address || null;
            }

            // Create feed
            const feed = await prisma.feed.create({
              data: {
                id: feedId,
                guid: podcastGuid || null,
                originalUrl: feedUrl,
                cdnUrl: feedUrl,
                type: 'album',
                priority: 'normal',
                title: piFeed.title,
                description: piFeed.description || null,
                artist: piFeed.author || null,
                image: piFeed.artwork || piFeed.image || null,
                language: piFeed.language || null,
                category: piFeed.categories ? (Object.values(piFeed.categories)[0] as string) : null,
                explicit: piFeed.explicit === 1,
                ...(v4vValue && { v4vValue }),
                ...(v4vRecipient && { v4vRecipient }),
                publisherId: publisher.id,
                lastFetched: new Date(),
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date()
              }
            });

            // Create tracks from PI API episodes
            if (episodes.length > 0) {
              const tracksData = episodes.map((ep, index) => {
                // Format episode-level v4v data
                let trackV4v = null;
                let trackV4vRecipient = null;
                if (ep.v4vValue?.destinations) {
                  trackV4v = {
                    type: ep.v4vValue.model?.type || 'lightning',
                    method: ep.v4vValue.model?.method || 'keysend',
                    suggested: ep.v4vValue.model?.suggested,
                    recipients: ep.v4vValue.destinations.map((r: any) => ({
                      name: r.name,
                      type: r.type,
                      address: r.address,
                      split: r.split,
                      customKey: r.customKey,
                      customValue: r.customValue,
                      fee: r.fee || false
                    }))
                  };
                  trackV4vRecipient = ep.v4vValue.destinations[0]?.address || null;
                }

                return {
                  id: `${feed.id}-${ep.guid || `track-${index}-${Date.now()}`}`,
                  feedId: feed.id,
                  guid: ep.guid,
                  title: ep.title,
                  description: ep.description || null,
                  audioUrl: ep.audioUrl,
                  duration: parseDuration(ep.duration),
                  image: ep.image || null,
                  publishedAt: ep.pubDate ? new Date(ep.pubDate) : new Date(),
                  trackOrder: ep.episode ? calculateTrackOrder(ep.episode, ep.season) : index + 1,
                  ...(trackV4v && { v4vValue: trackV4v }),
                  ...(trackV4vRecipient && { v4vRecipient: trackV4vRecipient }),
                  updatedAt: new Date()
                };
              });

              await prisma.track.createMany({
                data: tracksData,
                skipDuplicates: true
              });

              // Backfill oldestItemPubdate from tracks just imported
              const oldestPubDate = episodes
                .filter(e => e.pubDate)
                .map(e => new Date(e.pubDate))
                .sort((a, b) => a.getTime() - b.getTime())[0];

              if (oldestPubDate) {
                await prisma.feed.update({
                  where: { id: feed.id },
                  data: { oldestItemPubdate: oldestPubDate }
                });
              }
            }

            console.log(`   ✅ ${piFeed.title} (${episodes.length} tracks)`);
            result.imported++;

            await new Promise(r => setTimeout(r, 100));
          } catch (error) {
            result.failed++;
            result.errors.push(`${piFeed.title}: ${error instanceof Error ? error.message : 'Unknown'}`);
          }
        }

        // Link existing unlinked albums by artist name
        if (artistName) {
          await prisma.feed.updateMany({
            where: {
              artist: { equals: artistName, mode: 'insensitive' },
              type: { in: ['album', 'music', 'podcast'] },
              publisherId: null
            },
            data: { publisherId: publisher.id }
          });
        }

      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      }

      results.push(result);
    }

    const totals = {
      publishers: results.length,
      imported: results.reduce((s, r) => s + r.imported, 0),
      skipped: results.reduce((s, r) => s + r.skipped, 0),
      failed: results.reduce((s, r) => s + r.failed, 0)
    };

    console.log(`\n✅ Complete: ${totals.imported} imported, ${totals.skipped} skipped, ${totals.failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Processed ${totals.publishers} publishers: ${totals.imported} albums imported`,
      totals,
      results
    });

  } catch (error) {
    console.error('Error importing publisher albums:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
