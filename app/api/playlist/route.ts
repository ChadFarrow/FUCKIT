import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatDuration(duration: string): string {
  // Convert duration from MM:SS or HH:MM:SS to seconds
  const parts = duration.split(':').map(p => parseInt(p))
  let seconds = 0
  
  if (parts.length === 2) {
    seconds = parts[0] * 60 + parts[1]
  } else if (parts.length === 3) {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  
  return seconds.toString()
}

export async function GET(request: NextRequest) {
  try {
    // Read parsed feeds data
    const dataPath = join(process.cwd(), 'data', 'parsed-feeds.json')
    const rawData = readFileSync(dataPath, 'utf8')
    const data = JSON.parse(rawData)
    
    // Collect all tracks from all feeds
    const allTracks: any[] = []
    let trackId = 1
    
    data.feeds.forEach((feed: any) => {
      if (feed.parsedData?.album?.tracks) {
        feed.parsedData.album.tracks.forEach((track: any) => {
          allTracks.push({
            ...track,
            albumTitle: feed.parsedData.album.title,
            albumArtist: feed.parsedData.album.artist || 'Various Artists',
            albumCoverArt: feed.parsedData.album.coverArt,
            globalTrackNumber: trackId++
          })
        })
      }
    })
    
    // Shuffle tracks for variety
    for (let i = allTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allTracks[i], allTracks[j]] = [allTracks[j], allTracks[i]]
    }
    
    const currentDate = new Date().toUTCString()
    
    // Generate RSS XML with Podcasting 2.0 namespace
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:podcast="https://podcastindex.org/namespace/1.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Project StableKraft - All Songs Playlist</title>
    <description>A complete playlist of all songs from Project StableKraft, featuring music from The Doerfels, Able and the Wolf, and many more independent artists.</description>
    <link>https://project-stablekraft.com</link>
    <language>en-us</language>
    <pubDate>${currentDate}</pubDate>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <generator>Project StableKraft Playlist Generator</generator>
    
    <!-- Podcasting 2.0 Tags -->
    <podcast:medium>musicL</podcast:medium>
    <podcast:guid>stablekraft-all-songs-playlist-2025</podcast:guid>
    
    <!-- iTunes Tags -->
    <itunes:author>Project StableKraft</itunes:author>
    <itunes:summary>A complete playlist of all songs from Project StableKraft, featuring music from The Doerfels, Able and the Wolf, and many more independent artists.</itunes:summary>
    <itunes:type>episodic</itunes:type>
    <itunes:owner>
      <itunes:name>Project StableKraft</itunes:name>
      <itunes:email>contact@project-stablekraft.com</itunes:email>
    </itunes:owner>
    <itunes:explicit>false</itunes:explicit>
    <itunes:category text="Music" />
    <itunes:image href="https://www.doerfelverse.com/art/carol-of-the-bells.png" />
    
    <!-- Image -->
    <image>
      <url>https://www.doerfelverse.com/art/carol-of-the-bells.png</url>
      <title>Project StableKraft - All Songs Playlist</title>
      <link>https://project-stablekraft.com</link>
    </image>
    
    ${allTracks.map((track, index) => `
    <item>
      <title>${escapeXml(track.title)} - ${escapeXml(track.albumArtist)}</title>
      <description>From the album "${escapeXml(track.albumTitle)}" by ${escapeXml(track.albumArtist)}</description>
      <guid isPermaLink="false">stablekraft-playlist-track-${track.globalTrackNumber}</guid>
      <pubDate>${new Date(Date.now() - index * 3600000).toUTCString()}</pubDate>
      
      <enclosure url="${escapeXml(track.url)}" type="audio/mpeg" length="0" />
      
      <!-- Podcasting 2.0 Tags -->
      <podcast:track>${track.globalTrackNumber}</podcast:track>
      ${track.image ? `<podcast:images srcset="${escapeXml(track.image)} 3000w" />` : ''}
      
      <!-- iTunes Tags -->
      <itunes:title>${escapeXml(track.title)}</itunes:title>
      <itunes:artist>${escapeXml(track.albumArtist)}</itunes:artist>
      <itunes:album>${escapeXml(track.albumTitle)}</itunes:album>
      <itunes:duration>${formatDuration(track.duration)}</itunes:duration>
      <itunes:explicit>${track.explicit ? 'true' : 'false'}</itunes:explicit>
      ${track.image ? `<itunes:image href="${escapeXml(track.image)}" />` : ''}
      
      <content:encoded><![CDATA[
        <p>Track: ${escapeXml(track.title)}</p>
        <p>Artist: ${escapeXml(track.albumArtist)}</p>
        <p>Album: ${escapeXml(track.albumTitle)}</p>
        ${track.summary ? `<p>${escapeXml(track.summary)}</p>` : ''}
      ]]></content:encoded>
    </item>`).join('')}
  </channel>
</rss>`
    
    return new NextResponse(rssXml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Error generating playlist:', error)
    return NextResponse.json(
      { error: 'Failed to generate playlist' },
      { status: 500 }
    )
  }
}