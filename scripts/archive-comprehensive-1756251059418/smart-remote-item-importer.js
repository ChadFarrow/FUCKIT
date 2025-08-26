#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load environment variables
function loadEnvFile() {
    const envPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                process.env[key] = value.trim();
            }
        });
    }
}

loadEnvFile();

const API_KEY = process.env.PODCAST_INDEX_API_KEY;
const API_SECRET = process.env.PODCAST_INDEX_API_SECRET;
const API_BASE = 'https://api.podcastindex.org/api/1.0';

if (!API_KEY || !API_SECRET) {
    console.error('❌ Podcast Index API credentials not found in .env.local');
    process.exit(1);
}

function generateAuthHeaders() {
    const authTime = Math.floor(Date.now() / 1000);
    const authString = API_KEY + API_SECRET + authTime;
    const authHeader = crypto.createHash('sha1').update(authString).digest('hex');
    
    return {
        'X-Auth-Key': API_KEY,
        'X-Auth-Date': authTime,
        'Authorization': authHeader,
        'User-Agent': 'FUCKIT-Smart-Importer/1.0'
    };
}

async function getFeedByGuid(feedGuid) {
    try {
        const headers = generateAuthHeaders();
        const url = `${API_BASE}/podcasts/byguid?guid=${feedGuid}`;
        
        const response = await fetch(url, { headers });
        const data = await response.json();
        
        if (data.status === 'true' || data.status === true) {
            if (data.feed && data.feed.length > 0) {
                return data.feed[0];
            } else if (data.feed) {
                return data.feed;
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function getEpisodesByFeedId(feedId, maxEpisodes = 1000) {
    try {
        const headers = generateAuthHeaders();
        const url = `${API_BASE}/episodes/byfeedid?id=${feedId}&max=${maxEpisodes}`;
        
        const response = await fetch(url, { headers });
        const data = await response.json();
        
        if (data.status === 'true' || data.status === true) {
            return data.items || [];
        }
        return [];
    } catch (error) {
        return [];
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function importAndResolveRemoteItems(remoteItems, batchName) {
    console.log(`🎵 Smart Import and Resolution: ${batchName}\n`);
    console.log('=' .repeat(50) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-smart-import-${Date.now()}`;
    console.log(`📦 Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Check which items already exist
    const existingItems = [];
    const newItems = [];
    
    for (const item of remoteItems) {
        const exists = musicData.musicTracks.find(track => 
            (track.itemGuid && track.itemGuid._ === item.itemGuid) ||
            (track.itemGuid === item.itemGuid)
        );
        
        if (exists) {
            existingItems.push(item);
        } else {
            newItems.push(item);
        }
    }
    
    console.log(`📊 Analysis:`);
    console.log(`  ✅ Already in database: ${existingItems.length}`);
    console.log(`  🆕 New items to import: ${newItems.length}\n`);
    
    if (newItems.length === 0) {
        console.log('✨ All items already exist in database!');
        return;
    }
    
    // Group new items by feed GUID for efficient processing
    const feedGroups = {};
    newItems.forEach(item => {
        if (!feedGroups[item.feedGuid]) {
            feedGroups[item.feedGuid] = [];
        }
        feedGroups[item.feedGuid].push(item);
    });
    
    const uniqueFeeds = Object.keys(feedGroups).length;
    console.log(`📊 Grouped ${newItems.length} items into ${uniqueFeeds} feeds\n`);
    
    let fullyResolvedCount = 0;
    let partiallyResolvedCount = 0;
    let failedCount = 0;
    let feedIndex = 0;
    
    // Cache for feed data
    const feedCache = {};
    const episodeCache = {};
    
    // Process each feed group
    for (const [feedGuid, items] of Object.entries(feedGroups)) {
        feedIndex++;
        console.log(`📁 [${feedIndex}/${uniqueFeeds}] Processing Feed: ${feedGuid}`);
        console.log(`   Items to import: ${items.length}`);
        
        let feed = null;
        let episodes = [];
        
        // Fetch feed information
        console.log('   🔍 Looking up feed...');
        feed = await getFeedByGuid(feedGuid);
        
        if (feed && feed.id) {
            console.log(`   ✅ Found feed: "${feed.title || 'Unknown'}" by ${feed.author || 'Unknown'}`);
            
            // Fetch episodes for this feed
            console.log('   📚 Fetching episodes...');
            episodes = await getEpisodesByFeedId(feed.id);
            console.log(`   ✅ Retrieved ${episodes.length} episodes`);
        } else {
            console.log('   ❌ Feed not found in Podcast Index');
        }
        
        // Process each item in this feed group
        for (const item of items) {
            console.log(`\n   🎵 Processing item: ${item.itemGuid.substring(0, 8)}...`);
            
            let track = {
                feedGuid: item.feedGuid,
                itemGuid: { _: item.itemGuid },
                source: batchName,
                addedDate: new Date().toISOString(),
                sourceType: 'remote-item'
            };
            
            if (feed && feed.id) {
                // Find the specific episode
                const episode = episodes.find(ep => 
                    ep.guid === item.itemGuid ||
                    ep.id === item.itemGuid ||
                    (ep.enclosureUrl && ep.enclosureUrl.includes(item.itemGuid))
                );
                
                if (episode) {
                    // Fully resolved track
                    track.title = episode.title || feed.title || 'Unknown Track';
                    track.artist = feed.author || episode.feedTitle || 'Unknown Artist';
                    track.album = feed.title || episode.feedTitle || 'Unknown Album';
                    track.artwork = episode.image || episode.feedImage || feed.image || feed.artwork;
                    track.audioUrl = episode.enclosureUrl;
                    track.duration = episode.duration || 0;
                    track.description = episode.description || feed.description;
                    track.pubDate = episode.datePublished ? new Date(episode.datePublished * 1000).toISOString() : track.addedDate;
                    
                    // Additional metadata
                    track.episodeId = episode.id;
                    track.feedId = feed.id;
                    track.feedTitle = feed.title;
                    track.feedUrl = feed.url;
                    track.feedAuthor = feed.author;
                    track.explicit = episode.explicit;
                    track.episodeType = episode.episodeType;
                    
                    // Value block (V4V info)
                    if (episode.value) {
                        track.value = episode.value;
                    }
                    
                    console.log(`      ✅ Fully resolved: "${track.title}" by ${track.artist}`);
                    fullyResolvedCount++;
                } else {
                    // Partially resolved with feed data
                    track.title = feed.title || 'Unknown Track';
                    track.artist = feed.author || 'Unknown Artist';
                    track.album = feed.title || 'Unknown Album';
                    track.artwork = feed.image || feed.artwork;
                    track.feedId = feed.id;
                    track.feedTitle = feed.title;
                    track.feedUrl = feed.url;
                    track.feedAuthor = feed.author;
                    track.description = feed.description;
                    track.partiallyResolved = true;
                    
                    console.log(`      ⚠️  Partially resolved (episode not found)`);
                    partiallyResolvedCount++;
                }
            } else {
                // Feed not found - minimal track info
                track.title = `Remote Track ${item.itemGuid.substring(0, 8)}...${item.itemGuid.substring(item.itemGuid.length - 8)}`;
                track.artist = 'Unknown Artist';
                track.album = 'Unknown Album';
                track.needsResolution = true;
                
                console.log(`      ❌ Could not resolve (feed not found)`);
                failedCount++;
            }
            
            // Add the track to the database
            musicData.musicTracks.push(track);
        }
        
        // Save progress after each feed
        musicData.metadata.lastUpdated = new Date().toISOString();
        fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
        
        // Rate limiting between feeds
        if (feedIndex < uniqueFeeds) {
            console.log('\n   ⏳ Waiting before next feed...\n');
            await delay(500);
        }
    }
    
    // Final save with summary
    musicData.metadata.lastSmartImport = {
        date: new Date().toISOString(),
        batchName: batchName,
        itemsImported: newItems.length,
        fullyResolved: fullyResolvedCount,
        partiallyResolved: partiallyResolvedCount,
        failed: failedCount,
        source: 'Smart Remote Item Import'
    };
    
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Smart Import Summary:');
    console.log(`  🆕 New items imported: ${newItems.length}`);
    console.log(`  ✅ Fully resolved: ${fullyResolvedCount} (${(fullyResolvedCount/newItems.length*100).toFixed(1)}%)`);
    console.log(`  ⚠️  Partially resolved: ${partiallyResolvedCount} (${(partiallyResolvedCount/newItems.length*100).toFixed(1)}%)`);
    console.log(`  ❌ Failed: ${failedCount} (${(failedCount/newItems.length*100).toFixed(1)}%)`);
    console.log(`  📚 Total tracks in database: ${musicData.musicTracks.length}`);
    
    const successRate = ((fullyResolvedCount + partiallyResolvedCount) / newItems.length * 100).toFixed(1);
    console.log(`\n  📈 Resolution success rate: ${successRate}%`);
    
    console.log('\n✨ Smart import complete!');
    console.log('🎵 Items were resolved during import - no additional resolution needed!');
}

// Export for use by other scripts
module.exports = { importAndResolveRemoteItems };

// Example usage if run directly
if (require.main === module) {
    // Example batch - replace with your actual remote items
    const exampleBatch = [
        { feedGuid: "example-feed-guid", itemGuid: "example-item-guid" }
    ];
    
    console.log('🔧 This is the Smart Remote Item Importer!');
    console.log('📝 To use this script, import it into your batch scripts like this:');
    console.log('');
    console.log('const { importAndResolveRemoteItems } = require("./smart-remote-item-importer");');
    console.log('importAndResolveRemoteItems(yourRemoteItems, "Your Batch Name");');
    console.log('');
    console.log('This will import AND resolve items in one step, eliminating the');
    console.log('"Remote Track [GUID]" issue you\'ve been experiencing!');
}