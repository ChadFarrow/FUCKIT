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
    
    // Special handling for podcast feeds with music segments
    if (feedId === 'intothedoerfelverse') {
      // Extract music segments from podcast episodes using chapter data
      const musicTracks: any[] = []
      let trackId = 1
      
      for (const feed of feedsToProcess) {
        if (feed.parsedData?.album?.tracks) {
          for (const episode of feed.parsedData.album.tracks) {
            // Try to fetch chapter data for this episode
            const episodeNumber = episode.title.match(/Episode (\d+)/)?.[1]
            if (episodeNumber) {
              try {
                const chapterUrl = `https://www.doerfelverse.com/chapters/dvep${episodeNumber}.json`
                const chapterResponse = await fetch(chapterUrl)
                
                if (chapterResponse.ok) {
                  const chapterData = await chapterResponse.json()
                  
                  // Extract music segments (chapters that are not the main episode or intro)
                  const musicChapters = chapterData.chapters.filter((chapter: any) => 
                    !chapter.title.includes('Episode') && 
                    !chapter.title.includes('episode') &&
                    !chapter.title.includes('Into The Doerfel-Verse') &&
                    chapter.title.trim() !== '' &&
                    chapter.startTime > 0
                  )
                  
                  // Convert chapters to track format
                  for (let i = 0; i < musicChapters.length; i++) {
                    const chapter = musicChapters[i]
                    const nextChapter = musicChapters[i + 1] || chapterData.chapters[chapterData.chapters.findIndex((c: any) => c === chapter) + 1]
                    
                    // Calculate duration
                    const startTime = Math.floor(chapter.startTime)
                    const endTime = nextChapter ? Math.floor(nextChapter.startTime) : Math.floor(chapter.startTime) + 180 // Default 3 min if no end
                    const duration = endTime - startTime
                    
                    // Format duration as MM:SS
                    const minutes = Math.floor(duration / 60)
                    const seconds = duration % 60
                    const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`
                    
                    musicTracks.push({
                      title: chapter.title,
                      duration: formattedDuration,
                      url: `${episode.url}#t=${startTime},${endTime}`, // URL with time fragment
                      trackNumber: trackId++,
                      subtitle: `From ${episode.title}`,
                      summary: `Music segment from ${episode.title} at ${Math.floor(startTime / 60)}:${(startTime % 60).toString().padStart(2, '0')}`,
                      image: chapter.img || episode.image,
                      explicit: false,
                      albumTitle: feed.parsedData.album.title,
                      albumArtist: feed.parsedData.album.artist || 'The Doerfels',
                      albumCoverArt: chapter.img || feed.parsedData.album.coverArt,
                      feedId: feed.id,
                      globalTrackNumber: trackId - 1,
                      episodeTitle: episode.title,
                      episodeNumber: parseInt(episodeNumber),
                      startTime: startTime,
                      endTime: endTime
                    })
                  }
                }
              } catch (error) {
                console.error(`Failed to fetch chapters for episode ${episodeNumber}:`, error)
              }
            }
          }
        }
      }
      
      // Sort music tracks by episode number (ascending from episode 1)
      musicTracks.sort((a, b) => {
        // First sort by episode number
        if (a.episodeNumber !== b.episodeNumber) {
          return a.episodeNumber - b.episodeNumber;
        }
        // Then by start time within the same episode
        return a.startTime - b.startTime;
      });
      
      // Update track numbers after sorting
      musicTracks.forEach((track, index) => {
        track.trackNumber = index + 1;
        track.globalTrackNumber = index + 1;
      });
      
      // Return results
      if (format === 'json') {
        return NextResponse.json({
          title: 'Into The Doerfel-Verse - Music Segments',
          description: 'Music tracks played during Into The Doerfel-Verse podcast episodes, extracted from chapter markers',
          tracks: musicTracks,
          totalTracks: musicTracks.length,
          feedId: feedId
        })
      }
      
      // Generate RSS for music segments
      const currentDate = new Date().toUTCString()
      const playlistTitle = 'Into The Doerfel-Verse - Music Segments'
      
      const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:podcast="https://podcastindex.org/namespace/1.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(playlistTitle)}</title>
    <description>Music tracks played during Into The Doerfel-Verse podcast episodes, extracted from chapter markers</description>
    <link>https://project-stablekraft.com</link>
    <language>en-us</language>
    <pubDate>${currentDate}</pubDate>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <generator>Project StableKraft Playlist Generator</generator>
    
    <podcast:medium>musicL</podcast:medium>
    <podcast:guid>doerfelverse-music-segments-2025</podcast:guid>
    
    <itunes:author>The Doerfels</itunes:author>
    <itunes:summary>Music tracks played during Into The Doerfel-Verse podcast episodes</itunes:summary>
    <itunes:type>episodic</itunes:type>
    <itunes:category text="Music" />
    <itunes:image href="https://www.doerfelverse.com/art/itdvchadf.png" />
    
    ${musicTracks.map((track, index) => `
    <item>
      <title>${escapeXml(track.title)} - ${escapeXml(track.albumArtist)}</title>
      <description>From "${escapeXml(track.episodeTitle)}" at ${Math.floor(track.startTime / 60)}:${(track.startTime % 60).toString().padStart(2, '0')}</description>
      <guid isPermaLink="false">doerfelverse-music-segment-${track.globalTrackNumber}</guid>
      <pubDate>${new Date(Date.now() - index * 3600000).toUTCString()}</pubDate>
      
      <enclosure url="${escapeXml(track.url)}" type="audio/mpeg" length="0" />
      
      <podcast:track>${track.globalTrackNumber}</podcast:track>
      ${track.image ? `<podcast:images srcset="${escapeXml(track.image)} 3000w" />` : ''}
      
      <itunes:title>${escapeXml(track.title)}</itunes:title>
      <itunes:artist>${escapeXml(track.albumArtist)}</itunes:artist>
      <itunes:album>${escapeXml(track.albumTitle)}</itunes:album>
      <itunes:duration>${formatDuration(track.duration)}</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
      ${track.image ? `<itunes:image href="${escapeXml(track.image)}" />` : ''}
      
      <content:encoded><![CDATA[
        <p>Track: ${escapeXml(track.title)}</p>
        <p>Artist: ${escapeXml(track.albumArtist)}</p>
        <p>From: ${escapeXml(track.episodeTitle)}</p>
        <p>Time: ${Math.floor(track.startTime / 60)}:${(track.startTime % 60).toString().padStart(2, '0')} - ${Math.floor(track.endTime / 60)}:${(track.endTime % 60).toString().padStart(2, '0')}</p>
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