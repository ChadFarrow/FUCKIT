#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function fetchHGHFeed() {
  console.log('🔄 Fetching HGH RSS feed...');
  
  try {
    const response = await fetch('https://feed.homegrownhits.xyz/feed.xml');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const xml = await response.text();
    return xml;
  } catch (error) {
    console.error('❌ Failed to fetch HGH feed:', error.message);
    throw error;
  }
}

function parseRemoteItems(xml) {
  console.log('📋 Parsing remote items from RSS feed...');
  
  // Extract all podcast:remoteItem elements
  const remoteItemRegex = /<podcast:remoteItem\s+feedGuid="([^"]+)"\s+itemGuid="([^"]+)"\s*\/>/g;
  
  const remoteItems = [];
  let match;
  
  while ((match = remoteItemRegex.exec(xml)) !== null) {
    remoteItems.push({
      feedGuid: match[1],
      itemGuid: match[2]
    });
  }
  
  console.log(`✅ Found ${remoteItems.length} remote items`);
  return remoteItems;
}

function extractFeedMetadata(xml) {
  console.log('📊 Extracting feed metadata...');
  
  // Extract basic podcast info
  const titleMatch = xml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
  const descriptionMatch = xml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
  const imageMatch = xml.match(/<image[^>]*>\s*<url>(.*?)<\/url>/);
  
  const metadata = {
    title: titleMatch ? titleMatch[1] : 'Homegrown Hits',
    description: descriptionMatch ? descriptionMatch[1] : 'Music collection from Homegrown Hits podcast',
    image: imageMatch ? imageMatch[1] : 'https://raw.githubusercontent.com/ChadFarrow/ITDV-music-playlist/refs/heads/main/docs/HGH-playlist-art.webp'
  };
  
  console.log(`✅ Extracted metadata: ${metadata.title}`);
  return metadata;
}

async function main() {
  console.log('🎵 Parsing HGH feed and creating track data...');
  
  try {
    // Step 1: Fetch the RSS feed
    const xml = await fetchHGHFeed();
    
    // Step 2: Parse remote items
    const remoteItems = parseRemoteItems(xml);
    
    // Step 3: Extract feed metadata
    const feedMetadata = extractFeedMetadata(xml);
    
    // Step 4: Create track data in ITDV format
    const tracks = remoteItems.map((item, index) => {
      return {
        feedGuid: item.feedGuid,
        itemGuid: item.itemGuid,
        title: `Track ${index + 1}`, // We'll use generic titles since we can't resolve them
        artist: 'Homegrown Hits Artist', // Generic artist
        feedUrl: `https://podcast-index-lookup/${item.feedGuid}`, // Placeholder
        feedTitle: 'Various Artists',
        duration: 180, // Default 3 minutes
        // No audioUrl or artworkUrl since we can't resolve them
      };
    });
    
    console.log(`✅ Created ${tracks.length} track entries`);
    
    // Step 5: Save data files
    console.log('💾 Saving data files...');
    
    // Save the resolved songs JSON (matching ITDV format)
    const resolvedSongsPath = path.join(__dirname, '..', 'data', 'hgh-resolved-songs.json');
    fs.writeFileSync(resolvedSongsPath, JSON.stringify(tracks, null, 2));
    console.log(`✅ Saved: ${resolvedSongsPath}`);
    
    // Create empty audio URLs map (since we can't resolve audio)
    const audioUrlsPath = path.join(__dirname, '..', 'data', 'hgh-audio-urls.ts');
    const audioUrlsContent = `import { HGHAudioUrlMap } from '@/types/hgh-types';

// Audio URLs for HGH tracks - currently empty as tracks need to be resolved via Podcast Index
// Once tracks are resolved, this will be populated with actual audio URLs
export const HGH_AUDIO_URL_MAP: HGHAudioUrlMap = {
  // Placeholder entries - will be populated once tracks are resolved
  // Example format:
  // "Track Title": "https://audio-url.com/track.mp3"
};
`;
    fs.writeFileSync(audioUrlsPath, audioUrlsContent);
    console.log(`✅ Saved: ${audioUrlsPath}`);
    
    // Create empty artwork URLs map
    const artworkUrlsPath = path.join(__dirname, '..', 'data', 'hgh-artwork-urls.ts');
    const artworkUrlsContent = `import { HGHArtworkUrlMap } from '@/types/hgh-types';

// Artwork URLs for HGH tracks - currently empty as tracks need to be resolved via Podcast Index
// Once tracks are resolved, this will be populated with actual artwork URLs
export const HGH_ARTWORK_URL_MAP: HGHArtworkUrlMap = {
  // Placeholder entries - will be populated once tracks are resolved
  // Example format:
  // "Track Title": "https://artwork-url.com/image.jpg"
};
`;
    fs.writeFileSync(artworkUrlsPath, artworkUrlsContent);
    console.log(`✅ Saved: ${artworkUrlsPath}`);
    
    // Step 6: Save feed metadata
    const feedMetadataPath = path.join(__dirname, '..', 'data', 'hgh-feed-metadata.json');
    fs.writeFileSync(feedMetadataPath, JSON.stringify(feedMetadata, null, 2));
    console.log(`✅ Saved: ${feedMetadataPath}`);
    
    console.log('\n🎉 HGH feed parsing completed!');
    console.log(`📊 Total remote items: ${tracks.length}`);
    console.log('📁 Files created:');
    console.log(`  - ${resolvedSongsPath}`);
    console.log(`  - ${audioUrlsPath}`);  
    console.log(`  - ${artworkUrlsPath}`);
    console.log(`  - ${feedMetadataPath}`);
    console.log('\n📝 Note: Audio and artwork URLs are empty since the referenced');
    console.log('   feeds/episodes are not indexed in Podcast Index API.');
    console.log('   The playlist will show track listings but without playable audio.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();