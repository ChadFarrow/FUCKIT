import { NextResponse } from 'next/server';
import hghResolvedSongs from '@/data/hgh-resolved-songs.json';

export async function GET() {
  try {
    // Generate RSS feed XML with podcast:remoteItem elements
    const rssItems = hghResolvedSongs.map((song, index) => {
      return `    <item>
      <title>HGH Track ${index + 1}</title>
      <description>Music reference from Homegrown Hits podcast</description>
      <podcast:remoteItem feedGuid="${song.feedGuid}" itemGuid="${song.itemGuid}" />
    </item>`;
    }).join('\n');

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:podcast="https://podcastindex.org/namespace/1.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Homegrown Hits Music Playlist</title>
    <description>Every music reference from Homegrown Hits podcast</description>
    <link>https://homegrownhits.xyz</link>
    <language>en-us</language>
    <managingEditor>contact@homegrownhits.xyz (Homegrown Hits)</managingEditor>
    <webMaster>contact@homegrownhits.xyz (Homegrown Hits)</webMaster>
    <category>Music</category>
    <category>Technology</category>
    <podcast:guid>hgh-music-playlist-${Date.now()}</podcast:guid>
    <podcast:value type="lightning" method="keysend" suggested="0.00000005000">
      <podcast:valueRecipient name="Homegrown Hits" type="node" address="03ae9f91a0cb8ff43840e3c322c4c61f019d8c1c3cea15a25cfc425ac605e61a4a" split="100" />
    </podcast:value>
    <image>
      <url>https://homegrownhits.xyz/art/hgh-logo.png</url>
      <title>Homegrown Hits Music Playlist</title>
      <link>https://homegrownhits.xyz</link>
    </image>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    
${rssItems}
  </channel>
</rss>`;

    return new NextResponse(rssXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });

  } catch (error) {
    console.error('Error generating HGH RSS feed:', error);
    return NextResponse.json(
      { error: 'Failed to generate RSS feed' },
      { status: 500 }
    );
  }
}