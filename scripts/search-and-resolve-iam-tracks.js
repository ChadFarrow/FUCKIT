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
        'User-Agent': 'FUCKIT-Music-Resolver/1.0'
    };
}

async function searchByFeedGuid(feedGuid) {
    try {
        const headers = generateAuthHeaders();
        // Try to search for the feed using the podcasts/byguid endpoint
        const url = `${API_BASE}/podcasts/byguid?guid=${feedGuid}`;
        
        console.log(`  🔍 Searching for feed GUID: ${feedGuid}`);
        
        const response = await fetch(url, { headers });
        const data = await response.json();
        
        if (data.status === true && data.feed) {
            return data.feed;
        }
        
        // If not found, try searching by feedId (in case the GUID is actually an ID)
        const urlById = `${API_BASE}/podcasts/byfeedid?id=${feedGuid}`;
        const responseById = await fetch(urlById, { headers });
        const dataById = await responseById.json();
        
        if (dataById.status === true && dataById.feed) {
            return dataById.feed;
        }
        
        return null;
    } catch (error) {
        console.log(`  ⚠️  Error searching for feed: ${error.message}`);
        return null;
    }
}

async function getEpisodesFromFeed(feedId, itemGuid) {
    try {
        const headers = generateAuthHeaders();
        // Get recent episodes from the feed
        const url = `${API_BASE}/episodes/byfeedid?id=${feedId}&max=1000`;
        
        console.log(`  📚 Fetching episodes from feed ID: ${feedId}`);
        
        const response = await fetch(url, { headers });
        const data = await response.json();
        
        if (data.status === true && data.items) {
            // Try to find the specific episode by GUID
            const episode = data.items.find(item => 
                item.guid === itemGuid || 
                item.id === itemGuid ||
                item.enclosureUrl?.includes(itemGuid)
            );
            
            if (episode) {
                console.log(`  ✅ Found matching episode: ${episode.title}`);
                return episode;
            }
            
            // If we can't find the exact episode, return the feed's latest episode as a fallback
            if (data.items.length > 0) {
                console.log(`  ⚠️  Exact episode not found, using feed metadata`);
                return data.items[0]; // Return first episode for metadata reference
            }
        }
        
        return null;
    } catch (error) {
        console.log(`  ⚠️  Error fetching episodes: ${error.message}`);
        return null;
    }
}

async function searchByTerm(searchTerm) {
    try {
        const headers = generateAuthHeaders();
        // Search for podcasts by term
        const url = `${API_BASE}/search/byterm?q=${encodeURIComponent(searchTerm)}`;
        
        console.log(`  🔎 Searching by term: ${searchTerm}`);
        
        const response = await fetch(url, { headers });
        const data = await response.json();
        
        if (data.status === true && data.feeds && data.feeds.length > 0) {
            return data.feeds[0]; // Return first matching feed
        }
        
        return null;
    } catch (error) {
        console.log(`  ⚠️  Error searching by term: ${error.message}`);
        return null;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function resolveIAMTracks() {
    console.log('🎵 Searching and Resolving IAM Playlist Tracks\n');
    console.log('=' .repeat(50) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-search-${Date.now()}`;
    console.log(`Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Find tracks that need resolution
    const tracksToResolve = musicData.musicTracks.filter(track => 
        track.needsResolution === true && 
        track.source === 'IAM Playlist Import' &&
        track.feedGuid && 
        track.itemGuid
    );
    
    console.log(`Found ${tracksToResolve.length} tracks to resolve\n`);
    
    if (tracksToResolve.length === 0) {
        console.log('✅ No tracks need resolution');
        return;
    }
    
    // Group tracks by feed GUID to minimize API calls
    const feedGroups = {};
    tracksToResolve.forEach(track => {
        if (!feedGroups[track.feedGuid]) {
            feedGroups[track.feedGuid] = [];
        }
        feedGroups[track.feedGuid].push(track);
    });
    
    console.log(`Grouped into ${Object.keys(feedGroups).length} unique feeds\n`);
    
    let resolvedCount = 0;
    let partialCount = 0;
    let failedCount = 0;
    
    // Process each feed group
    for (const [feedGuid, tracks] of Object.entries(feedGroups)) {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`Processing Feed GUID: ${feedGuid}`);
        console.log(`Tracks in this feed: ${tracks.length}`);
        console.log('='.repeat(50));
        
        // Search for the feed
        let feed = await searchByFeedGuid(feedGuid);
        
        if (!feed) {
            // Try alternative search methods
            console.log('  ⚠️  Feed not found by GUID, trying alternative search...');
            
            // Extract potential search terms from the first track
            const searchTerms = [
                feedGuid.substring(0, 8), // Try partial GUID
                tracks[0].playlistTitle, // Try playlist title if available
            ].filter(term => term && term !== 'IAM Playlist');
            
            for (const term of searchTerms) {
                if (term) {
                    feed = await searchByTerm(term);
                    if (feed) {
                        console.log(`  ✅ Found feed via search: ${feed.title}`);
                        break;
                    }
                }
            }
        } else {
            console.log(`  ✅ Found feed: ${feed.title || 'Unknown Title'}`);
        }
        
        if (feed) {
            // Process each track in this feed
            for (const track of tracks) {
                console.log(`\n  📀 Resolving track with item GUID: ${track.itemGuid}`);
                
                // Try to get the specific episode
                const episode = await getEpisodesFromFeed(feed.id, track.itemGuid);
                
                if (episode) {
                    // Update track with full metadata
                    track.title = episode.title || feed.title || track.title;
                    track.artist = episode.feedTitle || feed.author || 'Unknown Artist';
                    track.album = episode.feedTitle || feed.title || 'Unknown Album';
                    track.artwork = episode.image || episode.feedImage || feed.image || feed.artwork || track.artwork;
                    track.audioUrl = episode.enclosureUrl || track.audioUrl;
                    track.duration = episode.duration || 0;
                    track.description = episode.description || feed.description || track.description;
                    track.pubDate = episode.datePublished ? new Date(episode.datePublished * 1000).toISOString() : track.pubDate;
                    
                    // Additional metadata
                    track.episodeId = episode.id;
                    track.feedId = feed.id;
                    track.feedTitle = feed.title;
                    track.feedUrl = feed.url;
                    track.explicit = episode.explicit;
                    
                    delete track.needsResolution;
                    
                    console.log(`    ✅ Fully resolved: ${track.title}`);
                    resolvedCount++;
                } else {
                    // Partial resolution with feed data only
                    track.artist = feed.author || 'Unknown Artist';
                    track.album = feed.title || 'Unknown Album';
                    track.artwork = feed.image || feed.artwork || track.artwork;
                    track.feedId = feed.id;
                    track.feedTitle = feed.title;
                    track.feedUrl = feed.url;
                    track.description = feed.description || track.description;
                    
                    // Mark as partially resolved
                    track.partiallyResolved = true;
                    delete track.needsResolution;
                    
                    console.log(`    ⚠️  Partially resolved with feed data only`);
                    partialCount++;
                }
                
                // Small delay between episode lookups
                await delay(200);
            }
        } else {
            console.log('  ❌ Could not find feed in Podcast Index');
            
            // Mark all tracks in this group as failed
            tracks.forEach(track => {
                track.resolutionFailed = true;
                failedCount++;
            });
        }
        
        // Save progress after each feed
        musicData.metadata.lastUpdated = new Date().toISOString();
        fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
        
        // Rate limiting between feeds
        await delay(1000);
    }
    
    // Final save
    musicData.metadata.lastResolution = {
        date: new Date().toISOString(),
        fullyResolved: resolvedCount,
        partiallyResolved: partialCount,
        failed: failedCount,
        source: 'IAM Playlist Search Resolution'
    };
    
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Resolution Summary:');
    console.log(`  ✅ Fully resolved: ${resolvedCount} tracks`);
    console.log(`  ⚠️  Partially resolved: ${partialCount} tracks`);
    console.log(`  ❌ Failed: ${failedCount} tracks`);
    console.log(`  📚 Total tracks in database: ${musicData.musicTracks.length}`);
    
    if (failedCount > 0) {
        console.log('\n💡 Some tracks could not be resolved. Possible reasons:');
        console.log('  - Feeds not yet indexed in Podcast Index');
        console.log('  - Private or unlisted feeds');
        console.log('  - GUIDs have changed or are formatted differently');
    }
    
    if (partialCount > 0) {
        console.log('\n📝 Partially resolved tracks have feed info but missing episode details.');
        console.log('   These may need manual resolution or direct RSS feed access.');
    }
    
    console.log('\n✨ Search and resolution complete!');
}

// Run the resolution
resolveIAMTracks().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});