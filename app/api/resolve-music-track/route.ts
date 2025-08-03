import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// This endpoint resolves V4V remoteItem references to actual music tracks
// by looking up the feedGuid and itemGuid from the Podcast Index API

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const feedGuid = searchParams.get('feedGuid');
    const itemGuid = searchParams.get('itemGuid');

    if (!feedGuid || !itemGuid) {
      return NextResponse.json(
        { error: 'Missing feedGuid or itemGuid parameter' },
        { status: 400 }
      );
    }

    console.log('Resolving track with feedGuid:', feedGuid, 'itemGuid:', itemGuid);

    // Use the working podcastindex endpoint as a proxy to avoid duplicating auth logic
    try {
      // First try to get feed info by feedGuid 
      const feedResponse = await fetch(
        `${request.nextUrl.origin}/api/podcastindex?guid=${encodeURIComponent(feedGuid)}`
      );
      
      if (feedResponse.ok) {
        const feedXml = await feedResponse.text();
        console.log('Feed XML length:', feedXml.length);
        
        // Parse feed title from XML (simple extraction)
        const titleMatch = feedXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        const feedTitle = titleMatch ? titleMatch[1] : 'Unknown Feed';
        
        // Now try to get episode by itemGuid
        const episodeResponse = await fetch(
          `${request.nextUrl.origin}/api/podcastindex?guid=${encodeURIComponent(itemGuid)}`
        );
        
        if (episodeResponse.ok) {
          const episodeXml = await episodeResponse.text();
          console.log('Episode XML length:', episodeXml.length);
          
          // Parse episode info from XML
          const episodeTitleMatch = episodeXml.match(/<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>/);
          const enclosureMatch = episodeXml.match(/<enclosure url="([^"]+)"/);
          const durationMatch = episodeXml.match(/<itunes:duration>(\d+)<\/itunes:duration>/);
          const imageMatch = episodeXml.match(/<itunes:image href="([^"]+)"/);
          
          if (episodeTitleMatch && enclosureMatch) {
            return NextResponse.json({
              success: true,
              track: {
                title: episodeTitleMatch[1],
                artist: feedTitle,
                audioUrl: enclosureMatch[1],
                duration: durationMatch ? parseInt(durationMatch[1]) : 0,
                image: imageMatch ? imageMatch[1] : null,
                feedTitle,
                episodeGuid: itemGuid,
                feedGuid
              }
            });
          }
        }
      }
      
      // If we get here, the GUIDs weren't found in Podcast Index
      return NextResponse.json({
        success: false,
        message: 'Track not found in Podcast Index. This might be a V4V remoteItem reference to a feed that is not in the Podcast Index database.',
        feedGuid,
        itemGuid
      });
      
    } catch (proxyError) {
      console.error('Error using podcastindex proxy:', proxyError);
      
      // Return a more helpful error message
      return NextResponse.json({
        success: false,
        message: 'Unable to resolve track. This V4V remoteItem may reference a feed not in the Podcast Index database.',
        feedGuid,
        itemGuid,
        error: proxyError instanceof Error ? proxyError.message : String(proxyError)
      });
    }

  } catch (error) {
    console.error('Error resolving music track:', error);
    return NextResponse.json(
      { 
        error: 'Failed to resolve music track',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}