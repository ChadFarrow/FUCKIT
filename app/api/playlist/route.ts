import { NextRequest, NextResponse } from 'next/server';
import { parseRSSFeedWithSegments } from '@/lib/rss-parser-db';
import { XMLParser } from 'fast-xml-parser';
import { prisma } from '@/lib/prisma';

interface RemoteItem {
  feedGuid: string;
  itemGuid: string;
  medium?: string;
  [key: string]: any;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'rss';
    const feedId = searchParams.get('feedId');
    
    // Default to HGH playlist
    const playlistUrl = 'https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/HGH-music-playlist.xml';
    
    console.log('📻 Fetching playlist from:', playlistUrl);
    
    // Parse musicL playlist using custom parser for remote items
    const response = await fetch(playlistUrl);
    const xmlText = await response.text();
    
    const xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    
    const parsed = xmlParser.parse(xmlText);
    const channel = parsed.rss?.channel;
    
    if (!channel) {
      throw new Error('Invalid RSS structure');
    }
    
    // Parse basic feed info
    const parsedFeed = {
      title: channel.title || 'Untitled Playlist',
      description: channel.description || '',
      image: channel.image?.url || channel.image || '',
      artist: channel.author || '',
      language: channel.language || 'en',
      category: 'musicL',
      explicit: false,
      items: []
    };
    
    // Extract remote items (tracks)
    const remoteItems = channel['podcast:remoteItem'] || [];
    const remoteItemsArray = Array.isArray(remoteItems) ? remoteItems : [remoteItems];
    
    console.log('📊 Found remote items:', remoteItemsArray.length);
    
    if (format === 'json') {
      // Resolve remote items to actual tracks from database
      const tracks = [];
      
      for (let i = 0; i < remoteItemsArray.length; i++) {
        const remoteItem = remoteItemsArray[i];
        const feedGuid = remoteItem['@_feedGuid'];
        const itemGuid = remoteItem['@_itemGuid'];
        
        try {
          // Multiple strategies to find the track:
          
          // Strategy 1: Direct track lookup by guid (most reliable)
          let track = await prisma.track.findFirst({
            where: {
              guid: itemGuid
            },
            include: {
              feed: true
            }
          });
          
          // Strategy 2: Find feed first, then track
          if (!track) {
            const feed = await prisma.feed.findFirst({
              where: {
                OR: [
                  { id: feedGuid },
                  { originalUrl: { contains: feedGuid } },
                  // Some feeds might have the guid in their metadata
                  { title: { contains: feedGuid } }
                ]
              }
            });
            
            if (feed) {
              track = await prisma.track.findFirst({
                where: {
                  feedId: feed.id,
                  OR: [
                    { guid: itemGuid },
                    { audioUrl: { contains: itemGuid } },
                    // Sometimes the itemGuid is a URL fragment
                    { title: { contains: itemGuid.split('/').pop() || itemGuid } }
                  ]
                },
                include: {
                  feed: true
                }
              });
            }
          }
          
          // Strategy 3: Broader search if URL-like itemGuid
          if (!track && itemGuid.includes('http')) {
            track = await prisma.track.findFirst({
              where: {
                audioUrl: { contains: itemGuid }
              },
              include: {
                feed: true
              }
            });
          }
          
          if (track) {
            tracks.push({
              title: track.title || `Track ${i + 1}`,
              duration: track.itunesDuration || (track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : '0:00'),
              url: track.audioUrl || '',
              trackNumber: i + 1,
              subtitle: track.subtitle || '',
              summary: track.description || '',
              image: track.image || track.itunesImage || '',
              explicit: track.explicit || false,
              keywords: track.itunesKeywords || [],
              albumTitle: parsedFeed.title,
              albumArtist: track.artist || track.feed?.artist || 'Unknown Artist',
              albumCoverArt: track.image || track.feed?.image || parsedFeed.image || '',
              feedId: track.feedId,
              feedTitle: track.feed?.title || 'Unknown Feed',
              itemGuid: track.guid,
              globalTrackNumber: i + 1
            });
            continue;
          }
          
          // If not found, add placeholder with remote item info
          tracks.push({
            title: `Track ${i + 1} (Remote)`,
            duration: '0:00',
            url: '',
            trackNumber: i + 1,
            subtitle: '',
            summary: `Remote item from feed ${feedGuid}`,
            image: '',
            explicit: false,
            keywords: [],
            albumTitle: parsedFeed.title,
            albumArtist: 'Unknown Artist',
            albumCoverArt: parsedFeed.image,
            feedId: feedGuid,
            itemGuid: itemGuid,
            globalTrackNumber: i + 1,
            isRemote: true
          });
          
        } catch (error) {
          console.error(`Error resolving remote item ${i}:`, error);
          tracks.push({
            title: `Track ${i + 1} (Error)`,
            duration: '0:00',
            url: '',
            trackNumber: i + 1,
            subtitle: '',
            summary: `Error resolving remote item`,
            image: '',
            explicit: false,
            keywords: [],
            albumTitle: parsedFeed.title,
            albumArtist: 'Unknown Artist',
            albumCoverArt: parsedFeed.image,
            feedId: feedGuid,
            itemGuid: itemGuid,
            globalTrackNumber: i + 1,
            isError: true
          });
        }
      }
      
      const playlistJson = {
        title: parsedFeed.title,
        description: parsedFeed.description,
        tracks: tracks,
        totalTracks: tracks.length,
        feedId: 'hgh-music-playlist',
        resolvedTracks: tracks.filter(t => !t.isRemote && !t.isError).length,
        remoteTracks: tracks.filter(t => t.isRemote).length,
        errorTracks: tracks.filter(t => t.isError).length
      };
      
      return NextResponse.json(playlistJson, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
        }
      });
    }
    
    // Return RSS format (default) - return the raw XML
    return new NextResponse(xmlText, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
    
  } catch (error) {
    console.error('Error in playlist API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to load playlist',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}