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

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

async function fetchDoerfelsFeed(): Promise<string> {
  const response = await fetch('https://www.doerfelverse.com/feeds/intothedoerfelverse.xml')
  if (!response.ok) {
    throw new Error(`Failed to fetch Doerfels feed: ${response.status}`)
  }
  return await response.text()
}

function parseValueTimeSplits(xmlContent: string): any[] {
  const tracks: any[] = []
  
  // Parse podcast:valueTimeSplit elements
  const valueTimeSplitRegex = /<podcast:valueTimeSplit[^>]*startTime="([^"]*)"[^>]*duration="([^"]*)"[^>]*remotePercentage="([^"]*)"[^>]*>[\s\S]*?<podcast:remoteItem[^>]*feedGuid="([^"]*)"[^>]*itemGuid="([^"]*)"[^>]*\/>[\s\S]*?<\/podcast:valueTimeSplit>/g
  
  let match
  let trackId = 1
  
  while ((match = valueTimeSplitRegex.exec(xmlContent)) !== null) {
    const [, startTime, duration, remotePercentage, feedGuid, itemGuid] = match
    
    // Convert to numbers
    const startTimeNum = parseFloat(startTime)
    const durationNum = parseFloat(duration)
    const remotePercentageNum = parseFloat(remotePercentage)
    
    // Skip invalid entries
    if (isNaN(startTimeNum) || isNaN(durationNum) || durationNum <= 0) {
      console.log(`⚠️ Skipping invalid valueTimeSplit: startTime=${startTime}, duration=${duration}`)
      continue
    }
    
    // Find the episode this track belongs to by looking for the enclosing item
    const beforeMatch = xmlContent.substring(0, match.index)
    const lastItemStart = beforeMatch.lastIndexOf('<item>')
    const lastItemEnd = beforeMatch.lastIndexOf('</item>')
    
    let episodeTitle = 'Unknown Episode'
    let episodeUrl = ''
    let episodeImage = ''
    
    if (lastItemStart > lastItemEnd) {
      // Extract episode info from the current item
      const itemStart = xmlContent.indexOf('<item>', match.index)
      const itemEnd = xmlContent.indexOf('</item>', match.index)
      
      if (itemStart !== -1 && itemEnd !== -1) {
        const itemContent = xmlContent.substring(itemStart, itemEnd)
        
        // Extract title
        const titleMatch = itemContent.match(/<title[^>]*>([^<]*)<\/title>/)
        if (titleMatch) {
          episodeTitle = titleMatch[1].trim()
        }
        
        // Extract enclosure URL
        const enclosureMatch = itemContent.match(/<enclosure[^>]*url="([^"]*)"[^>]*\/>/)
        if (enclosureMatch) {
          episodeUrl = enclosureMatch[1]
        }
        
        // Extract image
        const imageMatch = itemContent.match(/<itunes:image[^>]*href="([^"]*)"[^>]*\/>/)
        if (imageMatch) {
          episodeImage = imageMatch[1]
        }
      }
    }
    
    // Create track entry
    tracks.push({
      id: trackId++,
      title: `Track ${trackId - 1}`, // We'll need to fetch actual track info later
      duration: formatDuration(durationNum),
      durationSeconds: durationNum,
      startTime: startTimeNum,
      endTime: startTimeNum + durationNum,
      remotePercentage: remotePercentageNum,
      feedGuid: feedGuid,
      itemGuid: itemGuid,
      episodeTitle: episodeTitle,
      episodeUrl: episodeUrl,
      episodeImage: episodeImage,
      trackUrl: `${episodeUrl}#t=${Math.floor(startTimeNum)},${Math.floor(startTimeNum + durationNum)}`,
      artist: 'The Doerfels', // Default, will be updated when we fetch remote item data
      album: episodeTitle
    })
  }
  
  return tracks
}

async function fetchRemoteItemData(feedGuid: string, itemGuid: string): Promise<any> {
  try {
    // This would need to be implemented to fetch the actual track data
    // from the remote feed using feedGuid and itemGuid
    // For now, return placeholder data
    return {
      title: `Track from ${feedGuid}`,
      artist: 'Unknown Artist',
      duration: '0:00'
    }
  } catch (error) {
    console.error(`Failed to fetch remote item data for ${feedGuid}/${itemGuid}:`, error)
    return {
      title: `Track from ${feedGuid}`,
      artist: 'Unknown Artist',
      duration: '0:00'
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const feedId = searchParams.get('feedId')
    const format = searchParams.get('format') || 'rss' // 'rss' or 'json'
    
    // Only handle Doerfels feed for now
    if (feedId !== 'intothedoerfelverse') {
      return NextResponse.json(
        { error: 'Only Doerfels feed (intothedoerfelverse) is supported for auto playlist generation' },
        { status: 400 }
      )
    }
    
    // Fetch the Doerfels RSS feed
    console.log('🎵 Fetching Doerfels RSS feed for auto playlist generation...')
    const feedXml = await fetchDoerfelsFeed()
    
    // Parse valueTimeSplit elements
    console.log('🎵 Parsing podcast:valueTimeSplit elements...')
    const tracks = parseValueTimeSplits(feedXml)
    
    console.log(`🎵 Found ${tracks.length} tracks from valueTimeSplit elements`)
    
    // Sort tracks by start time (chronological order)
    tracks.sort((a, b) => a.startTime - b.startTime)
    
    // Update track IDs after sorting
    tracks.forEach((track, index) => {
      track.id = index + 1
    })
    
    // Return JSON format if requested
    if (format === 'json') {
      return NextResponse.json({
        title: 'Into The Doerfel-Verse - Auto Generated Playlist',
        description: 'Individual tracks extracted from Into The Doerfel-Verse podcast episodes using podcast:valueTimeSplit elements',
        tracks: tracks,
        totalTracks: tracks.length,
        feedId: feedId,
        generatedAt: new Date().toISOString()
      })
    }
    
    // Generate RSS XML
    const currentDate = new Date().toUTCString()
    const playlistTitle = 'Into The Doerfel-Verse - Auto Generated Playlist'
    
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:podcast="https://podcastindex.org/namespace/1.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(playlistTitle)}</title>
    <description>Individual tracks extracted from Into The Doerfel-Verse podcast episodes using podcast:valueTimeSplit elements</description>
    <link>https://project-stablekraft.com</link>
    <language>en-us</language>
    <pubDate>${currentDate}</pubDate>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <generator>Project StableKraft Auto Playlist Generator</generator>
    
    <podcast:medium>musicL</podcast:medium>
    <podcast:guid>doerfelverse-auto-playlist-2025</podcast:guid>
    
    <itunes:author>The Doerfels</itunes:author>
    <itunes:summary>Individual tracks extracted from Into The Doerfel-Verse podcast episodes</itunes:summary>
    <itunes:type>episodic</itunes:type>
    <itunes:category text="Music" />
    <itunes:image href="https://www.doerfelverse.com/art/itdvchadf.png" />
    
    ${tracks.map((track, index) => `
    <item>
      <title>${escapeXml(track.title)} - ${escapeXml(track.artist)}</title>
      <description>From "${escapeXml(track.episodeTitle)}" at ${Math.floor(track.startTime / 60)}:${(track.startTime % 60).toString().padStart(2, '0')} (${track.duration})</description>
      <guid isPermaLink="false">doerfelverse-auto-track-${track.id}</guid>
      <pubDate>${new Date(Date.now() - index * 3600000).toUTCString()}</pubDate>
      
      <enclosure url="${escapeXml(track.trackUrl)}" type="audio/mpeg" length="0" />
      
      <podcast:track>${track.id}</podcast:track>
      ${track.episodeImage ? `<podcast:images srcset="${escapeXml(track.episodeImage)} 3000w" />` : ''}
      
      <itunes:title>${escapeXml(track.title)}</itunes:title>
      <itunes:artist>${escapeXml(track.artist)}</itunes:artist>
      <itunes:album>${escapeXml(track.album)}</itunes:album>
      <itunes:duration>${track.durationSeconds}</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
      ${track.episodeImage ? `<itunes:image href="${escapeXml(track.episodeImage)}" />` : ''}
      
      <content:encoded><![CDATA[
        <p>Track: ${escapeXml(track.title)}</p>
        <p>Artist: ${escapeXml(track.artist)}</p>
        <p>From: ${escapeXml(track.episodeTitle)}</p>
        <p>Time: ${Math.floor(track.startTime / 60)}:${(track.startTime % 60).toString().padStart(2, '0')} - ${Math.floor(track.endTime / 60)}:${(track.endTime % 60).toString().padStart(2, '0')}</p>
        <p>Duration: ${track.duration}</p>
        <p>Remote Percentage: ${track.remotePercentage}%</p>
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
    console.error('Error generating auto playlist:', error)
    return NextResponse.json(
      { error: 'Failed to generate auto playlist', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}