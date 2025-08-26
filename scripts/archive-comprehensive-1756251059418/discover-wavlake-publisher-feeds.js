#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const crypto = require('crypto');

async function generateAuthHeaders(apiKey, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = crypto.createHash('sha1').update(apiKey + apiSecret + timestamp).digest('hex');
  
  return {
    'User-Agent': 'FUCKIT-Music-Discovery/1.0',
    'X-Auth-Key': apiKey,
    'X-Auth-Date': timestamp.toString(),
    'Authorization': hash
  };
}

// Function to extract artist GUID from Wavlake album feeds by checking for podcast:remoteItem
async function getPublisherFeedFromAlbum(albumFeedUrl) {
  try {
    console.log(`🔍 Checking ${albumFeedUrl} for publisher feed reference...`);
    
    const response = await fetch(albumFeedUrl);
    const feedXml = await response.text();
    
    // Look for podcast:remoteItem with feedGuid that points to artist feed
    const remoteItemMatch = feedXml.match(/<podcast:remoteItem[^>]*feedGuid="([^"]+)"[^>]*>/);
    if (remoteItemMatch) {
      const artistGuid = remoteItemMatch[1];
      console.log(`   ✅ Found artist GUID: ${artistGuid}`);
      
      // Construct artist feed URL
      const artistFeedUrl = `https://wavlake.com/feed/artist/${artistGuid}`;
      return {
        artistGuid,
        artistFeedUrl,
        sourceAlbumUrl: albumFeedUrl
      };
    }
    
    console.log(`   ❌ No publisher feed reference found`);
    return null;
    
  } catch (error) {
    console.error(`   ❌ Error checking album feed:`, error.message);
    return null;
  }
}

// Function to verify and get details of a publisher feed
async function verifyPublisherFeed(artistFeedUrl, artistGuid) {
  try {
    console.log(`📡 Verifying publisher feed: ${artistFeedUrl}`);
    
    const response = await fetch(artistFeedUrl);
    if (!response.ok) {
      console.log(`   ❌ Feed not accessible (${response.status})`);
      return null;
    }
    
    const feedXml = await response.text();
    
    // Extract basic feed info
    const titleMatch = feedXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
    const descMatch = feedXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
    const imageMatch = feedXml.match(/<itunes:image[^>]*href="([^"]+)"/);
    
    // Count remote items (albums/releases)
    const remoteItemMatches = feedXml.match(/<podcast:remoteItem/g);
    const remoteItemCount = remoteItemMatches ? remoteItemMatches.length : 0;
    
    const publisherInfo = {
      artistGuid,
      artistFeedUrl,
      title: titleMatch ? titleMatch[1] : 'Unknown Artist',
      description: descMatch ? descMatch[1] : '',
      artwork: imageMatch ? imageMatch[1] : null,
      remoteItemCount,
      verified: true
    };
    
    console.log(`   ✅ Verified: "${publisherInfo.title}" (${remoteItemCount} releases)`);
    return publisherInfo;
    
  } catch (error) {
    console.error(`   ❌ Error verifying publisher feed:`, error.message);
    return null;
  }
}

async function discoverWavlakePublisherFeeds() {
  console.log('🌊 Discovering Wavlake Publisher Feeds...\n');
  
  // Load existing data
  const musicTracksPath = path.join(__dirname, '../data/music-tracks.json');
  const parsedFeedsPath = path.join(__dirname, '../data/parsed-feeds.json');
  const publisherResultsPath = path.join(__dirname, '../data/publisher-feed-results.json');
  
  if (!fs.existsSync(musicTracksPath) || !fs.existsSync(parsedFeedsPath)) {
    console.error('❌ Required data files not found');
    return;
  }
  
  const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
  const parsedData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
  
  // Load existing publisher feeds to avoid duplicates
  let existingPublishers = [];
  if (fs.existsSync(publisherResultsPath)) {
    existingPublishers = JSON.parse(fs.readFileSync(publisherResultsPath, 'utf8'));
  }
  
  const existingGuids = new Set(
    existingPublishers.map(p => p.feed?.originalUrl?.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/)?.[1]).filter(Boolean)
  );
  
  console.log(`📊 Found ${existingGuids.size} existing publisher feeds`);
  
  // Get all Wavlake album feeds
  const wavlakeFeeds = parsedData.feeds.filter(feed => 
    feed.originalUrl && feed.originalUrl.includes('wavlake.com') &&
    feed.parseStatus === 'success'
  );
  
  console.log(`🎵 Found ${wavlakeFeeds.length} Wavlake album feeds to check\n`);
  
  const discoveredPublishers = [];
  const processedGuids = new Set();
  let checkedCount = 0;
  let discoveredCount = 0;
  let skippedCount = 0;
  
  for (let i = 0; i < wavlakeFeeds.length; i++) {
    const albumFeed = wavlakeFeeds[i];
    const albumTitle = albumFeed.parsedData?.album?.title || albumFeed.title;
    const albumArtist = albumFeed.parsedData?.album?.artist;
    
    console.log(`[${i + 1}/${wavlakeFeeds.length}] Album: "${albumTitle}" by ${albumArtist}`);
    
    try {
      // Check this album feed for publisher feed reference
      const publisherRef = await getPublisherFeedFromAlbum(albumFeed.originalUrl);
      
      if (publisherRef) {
        const { artistGuid, artistFeedUrl } = publisherRef;
        
        // Skip if we already have this publisher or processed it
        if (existingGuids.has(artistGuid) || processedGuids.has(artistGuid)) {
          console.log(`   ⏭️  Publisher already known: ${artistGuid}`);
          skippedCount++;
        } else {
          // Verify and get details of this publisher feed
          const publisherInfo = await verifyPublisherFeed(artistFeedUrl, artistGuid);
          
          if (publisherInfo) {
            // Convert to the format expected by publisher-feed-results.json
            const publisherEntry = {
              feed: {
                id: `wavlake-publisher-${artistGuid.slice(0, 8)}`,
                originalUrl: artistFeedUrl,
                type: 'publisher',
                title: `${publisherInfo.title} (Wavlake)`
              },
              imageUrl: null,
              imageTag: null,
              artworkTag: null,
              imgTag: null,
              itunesImage: publisherInfo.artwork,
              description: `<![CDATA[${publisherInfo.description}]]>`,
              title: `<![CDATA[${publisherInfo.title}]]>`,
              discoveredFrom: albumFeed.originalUrl,
              discoveredAt: new Date().toISOString(),
              remoteItemCount: publisherInfo.remoteItemCount
            };
            
            discoveredPublishers.push(publisherEntry);
            processedGuids.add(artistGuid);
            discoveredCount++;
            
            console.log(`   🎉 NEW PUBLISHER DISCOVERED: "${publisherInfo.title}"`);
            console.log(`       Releases: ${publisherInfo.remoteItemCount}`);
            console.log(`       Artwork: ${publisherInfo.artwork ? 'Yes' : 'No'}`);
          }
        }
      }
      
      checkedCount++;
      
      // Rate limiting to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`   ❌ Error processing album "${albumTitle}":`, error.message);
    }
    
    console.log('');
  }
  
  // Update publisher feeds file
  if (discoveredPublishers.length > 0) {
    const updatedPublishers = [...existingPublishers, ...discoveredPublishers];
    
    // Sort by title for better organization
    updatedPublishers.sort((a, b) => {
      const titleA = a.title?.replace(/<!\\[CDATA\\[|\\]\\]>/g, '') || '';
      const titleB = b.title?.replace(/<!\\[CDATA\\[|\\]\\]>/g, '') || '';
      return titleA.localeCompare(titleB);
    });
    
    console.log('💾 Saving updated publisher feeds...');
    fs.writeFileSync(publisherResultsPath, JSON.stringify(updatedPublishers, null, 2));
    
    // Create backup
    const backupPath = publisherResultsPath + `.backup-discovery-${Date.now()}`;
    fs.writeFileSync(backupPath, JSON.stringify(existingPublishers, null, 2));
    console.log(`📁 Backup saved: ${path.basename(backupPath)}`);
  }
  
  // Final summary
  console.log('=' .repeat(60));
  console.log('🏁 WAVLAKE PUBLISHER FEED DISCOVERY COMPLETE');
  console.log('=' .repeat(60));
  console.log(`📊 Albums checked: ${checkedCount}`);
  console.log(`🆕 New publishers discovered: ${discoveredCount}`);
  console.log(`⏭️  Publishers already known: ${skippedCount}`);
  console.log(`📈 Total publishers now: ${existingPublishers.length + discoveredCount}`);
  
  if (discoveredCount > 0) {
    console.log('\\n🎉 NEW PUBLISHERS DISCOVERED:');
    discoveredPublishers.forEach((publisher, index) => {
      const title = publisher.title?.replace(/<!\\[CDATA\\[|\\]\\]>/g, '') || 'Unknown';
      console.log(`   ${index + 1}. ${title} (${publisher.remoteItemCount} releases)`);
    });
    
    console.log('\\n💡 Run the comprehensive artwork check again to verify these new publisher feeds!');
  } else {
    console.log('\\n✅ No new publisher feeds found - discovery is complete');
  }
  
  return {
    checked: checkedCount,
    discovered: discoveredCount,
    skipped: skippedCount,
    newPublishers: discoveredPublishers
  };
}

if (require.main === module) {
  discoverWavlakePublisherFeeds().catch(console.error);
}

module.exports = { discoverWavlakePublisherFeeds };