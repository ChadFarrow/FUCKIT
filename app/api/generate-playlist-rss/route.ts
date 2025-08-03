import { NextRequest, NextResponse } from 'next/server';
import { MusicTrackParser } from '@/lib/music-track-parser';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const feedUrl = searchParams.get('feedUrl') || 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml';
    const format = searchParams.get('format') || 'rss'; // 'rss' or 'json'
    
    // Extract music tracks from the feed
    const result = await MusicTrackParser.extractMusicTracks(feedUrl);
    
    // Filter for V4V tracks with remoteItem references
    const v4vTracks = result.tracks.filter(track => 
      track.source === 'value-split' && 
      track.valueForValue?.feedGuid && 
      track.valueForValue?.itemGuid
    );
    
    // Group tracks by episode for better organization
    const tracksByEpisode = v4vTracks.reduce((acc, track) => {
      if (!acc[track.episodeTitle]) {
        acc[track.episodeTitle] = [];
      }
      acc[track.episodeTitle].push(track);
      return acc;
    }, {} as Record<string, typeof v4vTracks>);
    
    // Generate RSS XML
    const rssXml = generatePlaylistRSS(tracksByEpisode, feedUrl);
    
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        totalTracks: v4vTracks.length,
        episodeCount: Object.keys(tracksByEpisode).length,
        tracks: v4vTracks
      });
    }
    
    // Return RSS XML with proper content type
    return new NextResponse(rssXml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Content-Disposition': 'attachment; filename="itdv-music-playlist.xml"'
      }
    });
    
  } catch (error) {
    console.error('Error generating playlist RSS:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate playlist RSS',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

function generatePlaylistRSS(tracksByEpisode: Record<string, any[]>, sourceFeedUrl: string): string {
  const now = new Date().toUTCString();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  // Calculate total tracks
  const totalTracks = Object.values(tracksByEpisode).reduce((sum, tracks) => sum + tracks.length, 0);
  
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:podcast="https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Into The Doerfel Verse - Music Playlist</title>
    <description>A curated playlist of ${totalTracks} music tracks featured on Into The Doerfel Verse podcast. Each track is extracted using V4V (Value for Value) metadata and represents original music played during episodes.</description>
    <link>https://www.doerfelverse.com</link>
    <language>en-us</language>
    <copyright>Music rights belong to respective artists</copyright>
    <lastBuildDate>${now}</lastBuildDate>
    <pubDate>${now}</pubDate>
    <generator>FUCKIT Music Extractor</generator>
    <atom:link href="${baseUrl}/api/generate-playlist-rss?feedUrl=${encodeURIComponent(sourceFeedUrl)}" rel="self" type="application/rss+xml"/>
    
    <itunes:author>The Doerfels</itunes:author>
    <itunes:summary>Music playlist from Into The Doerfel Verse podcast</itunes:summary>
    <itunes:owner>
      <itunes:name>The Doerfels</itunes:name>
      <itunes:email>thedoerfels@example.com</itunes:email>
    </itunes:owner>
    <itunes:explicit>no</itunes:explicit>
    <itunes:category text="Music"/>
    <itunes:image href="https://www.doerfelverse.com/images/podcast-cover.jpg"/>
    
    <podcast:medium>music</podcast:medium>
    <podcast:guid>playlist-${generateGuid(sourceFeedUrl)}</podcast:guid>
    
    ${generateTrackItems(tracksByEpisode, baseUrl)}
  </channel>
</rss>`;

  return xml;
}

function generateTrackItems(tracksByEpisode: Record<string, any[]>, baseUrl: string): string {
  const items: string[] = [];
  let trackNumber = 1;
  
  // Sort episodes by episode number
  const sortedEpisodes = Object.entries(tracksByEpisode).sort((a, b) => {
    const aNum = extractEpisodeNumber(a[0]);
    const bNum = extractEpisodeNumber(b[0]);
    return aNum - bNum;
  });
  
  for (const [episodeTitle, tracks] of sortedEpisodes) {
    for (const track of tracks) {
      const duration = track.duration || (track.endTime - track.startTime);
      const durationFormatted = formatDuration(duration);
      
      // Generate a unique GUID for this track
      const trackGuid = `${track.valueForValue?.feedGuid || 'unknown'}-${track.valueForValue?.itemGuid || track.id}`;
      
      const item = `
    <item>
      <title>Track ${trackNumber}: ${escapeXml(track.title)}</title>
      <description>
        <![CDATA[
          <p>From: ${escapeXml(episodeTitle)}</p>
          <p>Artist: ${escapeXml(track.artist)}</p>
          <p>Duration: ${durationFormatted}</p>
          ${track.valueForValue?.feedGuid ? `<p>Music Feed: ${track.valueForValue.feedGuid}</p>` : ''}
          ${track.valueForValue?.itemGuid ? `<p>Track ID: ${track.valueForValue.itemGuid}</p>` : ''}
          <p>Time in episode: ${formatTime(track.startTime)} - ${formatTime(track.endTime)}</p>
        ]]>
      </description>
      <guid isPermaLink="false">${trackGuid}</guid>
      <pubDate>${track.episodeDate ? new Date(track.episodeDate).toUTCString() : new Date().toUTCString()}</pubDate>
      <enclosure url="${escapeXml(track.audioUrl || '')}" type="audio/mpeg" length="${duration * 128000}"/>
      <itunes:duration>${durationFormatted}</itunes:duration>
      <itunes:episode>${trackNumber}</itunes:episode>
      <itunes:author>${escapeXml(track.artist)}</itunes:author>
      <itunes:explicit>no</itunes:explicit>
      
      ${track.valueForValue?.feedGuid ? `
      <podcast:soundbite startTime="${track.startTime}" duration="${duration}">
        <podcast:title>${escapeXml(track.title)}</podcast:title>
      </podcast:soundbite>
      
      <podcast:valueTimeSplit startTime="${track.startTime}" duration="${duration}" remotePercentage="${track.valueForValue.remotePercentage || 90}">
        <podcast:remoteItem feedGuid="${track.valueForValue.feedGuid}" itemGuid="${track.valueForValue.itemGuid}"/>
      </podcast:valueTimeSplit>` : ''}
      
      <podcast:track>${trackNumber}</podcast:track>
      <podcast:season>1</podcast:season>
    </item>`;
      
      items.push(item);
      trackNumber++;
    }
  }
  
  return items.join('\n');
}

function extractEpisodeNumber(episodeTitle: string): number {
  const match = episodeTitle.match(/Episode (\d+)/i);
  return match ? parseInt(match[1], 10) : 999;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
  return formatDuration(seconds);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateGuid(input: string): string {
  // Simple hash function to generate a consistent GUID from the input
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}