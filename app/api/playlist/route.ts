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
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const feedId = searchParams.get('feedId')
    const format = searchParams.get('format') || 'rss' // 'rss' or 'json'
    
    // Read parsed feeds data
    const dataPath = join(process.cwd(), 'data', 'parsed-feeds.json')
    const rawData = readFileSync(dataPath, 'utf8')
    const data = JSON.parse(rawData)
    
    // Filter feeds if feedId is provided
    let feedsToProcess = feedId 
      ? data.feeds.filter((feed: any) => feed.id === feedId)
      : data.feeds
    
    // For general playlist (no feedId), exclude podcast feeds that contain episodes rather than songs
    if (!feedId) {
      feedsToProcess = feedsToProcess.filter((feed: any) => {
        // Exclude feeds that are primarily podcast episodes
        // Check if the feed contains mostly long-form content or episodes
        if (feed.id === 'intothedoerfelverse') {
          console.log(`🎵 Excluding podcast feed from general playlist: ${feed.title}`)
          return false
        }
        return true
      })
    }
    
    // Special handling for podcast feeds
    if (feedId === 'intothedoerfelverse') {
      // This is a podcast feed, not a music feed - return empty playlist with explanation
      const playlistTitle = 'Into The Doerfel-Verse - Podcast Episodes'
      const playlistDescription = 'This is a podcast about music, not a music playlist. The episodes contain discussions about music and may include music segments, but are not individual songs suitable for a music playlist.'
      
      if (format === 'json') {
        return NextResponse.json({
          title: playlistTitle,
          description: playlistDescription,
          tracks: [],
          totalTracks: 0,
          feedId: feedId,
          isPodcast: true,
          message: 'This feed contains podcast episodes, not individual music tracks. For music, try the main "Play All Songs" playlist.'
        })
      }
      
      // Return RSS with explanation
      const currentDate = new Date().toUTCString()
      const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:podcast="https://podcastindex.org/namespace/1.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${escapeXml(playlistTitle)}</title>
    <description>${escapeXml(playlistDescription)}</description>
    <link>https://project-stablekraft.com</link>
    <language>en-us</language>
    <pubDate>${currentDate}</pubDate>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <generator>Project StableKraft Playlist Generator</generator>
    
    <podcast:medium>podcast</podcast:medium>
    <itunes:type>episodic</itunes:type>
    <itunes:category text="Music Commentary" />
    
    <item>
      <title>This is a podcast feed, not a music playlist</title>
      <description>${escapeXml(playlistDescription + ' For individual music tracks, use the main "Play All Songs" playlist.')}</description>
      <guid isPermaLink="false">podcast-explanation-${Date.now()}</guid>
      <pubDate>${currentDate}</pubDate>
    </item>
  </channel>
</rss>`
      
      return new NextResponse(rssXml, {
        headers: {
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }
    
    // Collect all tracks from selected feeds
    const allTracks: any[] = []
    let trackId = 1
    
    feedsToProcess.forEach((feed: any) => {
      if (feed.parsedData?.album?.tracks) {
        feed.parsedData.album.tracks.forEach((track: any) => {
          // Filter out podcast episodes - songs should be under 15 minutes typically
          // Convert duration to seconds for comparison
          const durationParts = track.duration.split(':').map((p: string) => parseInt(p))
          let durationSeconds = 0
          
          if (durationParts.length === 2) {
            durationSeconds = durationParts[0] * 60 + durationParts[1]
          } else if (durationParts.length === 3) {
            durationSeconds = durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
          }
          
          // Skip tracks longer than 15 minutes (900 seconds) - likely podcast episodes
          // Also skip tracks with "Episode" in the title
          if (durationSeconds > 900 || track.title.toLowerCase().includes('episode')) {
            console.log(`🎵 Filtering out podcast episode: "${track.title}" (${track.duration})`)
            return
          }
          
          allTracks.push({
            ...track,
            albumTitle: feed.parsedData.album.title,
            albumArtist: feed.parsedData.album.artist || 'Various Artists',
            albumCoverArt: feed.parsedData.album.coverArt,
            feedId: feed.id,
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
    
    // Return JSON format if requested
    if (format === 'json') {
      return NextResponse.json({
        title: feedId ? `${feedsToProcess[0]?.title || 'Selected'} - Playlist` : 'Project StableKraft - All Songs Playlist',
        description: feedId 
          ? `All songs from ${feedsToProcess[0]?.title || 'the selected feed'}`
          : 'A complete playlist of all songs from Project StableKraft',
        tracks: allTracks,
        totalTracks: allTracks.length,
        feedId: feedId || null
      })
    }
    
    const currentDate = new Date().toUTCString()
    const playlistTitle = feedId && feedsToProcess.length > 0 
      ? `${feedsToProcess[0].title} - Playlist`
      : 'Project StableKraft - All Songs Playlist'
    
    // Generate RSS XML with Podcasting 2.0 namespace
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:podcast="https://podcastindex.org/namespace/1.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(playlistTitle)}</title>
    <description>${escapeXml(feedId 
      ? `All songs from ${feedsToProcess[0]?.title || 'the selected feed'}`
      : 'A complete playlist of all songs from Project StableKraft, featuring music from The Doerfels, Able and the Wolf, and many more independent artists.')}</description>
    <link>https://project-stablekraft.com</link>
    <language>en-us</language>
    <pubDate>${currentDate}</pubDate>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <generator>Project StableKraft Playlist Generator</generator>
    
    <!-- Podcasting 2.0 Tags -->
    <podcast:medium>musicL</podcast:medium>
    <podcast:guid>stablekraft-all-songs-playlist-2025</podcast:guid>
    
    <!-- iTunes Tags -->
    <itunes:author>${escapeXml(feedId && feedsToProcess.length > 0 ? feedsToProcess[0].parsedData?.album?.artist || 'Project StableKraft' : 'Project StableKraft')}</itunes:author>
    <itunes:summary>${escapeXml(feedId 
      ? `All songs from ${feedsToProcess[0]?.title || 'the selected feed'}`
      : 'A complete playlist of all songs from Project StableKraft, featuring music from The Doerfels, Able and the Wolf, and many more independent artists.')}</itunes:summary>
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
      <url>${escapeXml(feedId && feedsToProcess.length > 0 && feedsToProcess[0].parsedData?.album?.coverArt ? feedsToProcess[0].parsedData.album.coverArt : 'https://www.doerfelverse.com/art/carol-of-the-bells.png')}</url>
      <title>${escapeXml(playlistTitle)}</title>
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