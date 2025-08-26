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

async function fetchEpisodeByGuid(itemGuid, feedGuid = null) {
    try {
        const headers = generateAuthHeaders();
        const url = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${encodeURIComponent(itemGuid)}${feedGuid ? `&feedguid=${feedGuid}` : ''}`;
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            console.log(`  ⚠️  HTTP ${response.status} for item ${itemGuid}`);
            return null;
        }
        
        const data = await response.json();
        
        if (data.status === true && data.episode) {
            return data.episode;
        }
        
        return null;
    } catch (error) {
        console.log(`  ❌ Error fetching episode: ${error.message}`);
        return null;
    }
}

async function fetchByRemoteItem(feedGuid, itemGuid) {
    try {
        const headers = generateAuthHeaders();
        // Try the remoteitem endpoint
        const url = `https://api.podcastindex.org/api/1.0/episodes/byguid?guid=${encodeURIComponent(itemGuid)}&feedguid=${feedGuid}`;
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            return null;
        }
        
        const data = await response.json();
        
        if (data.status === true && data.episode) {
            return data.episode;
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function resolveRemoteItems() {
    console.log('🎵 Resolving IAM Playlist Remote Items Metadata\n');
    console.log('=' .repeat(50) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-resolve-${Date.now()}`;
    console.log(`Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Find tracks that need resolution (recently added IAM tracks)
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
    
    let resolvedCount = 0;
    let failedCount = 0;
    const batchSize = 5; // Process in small batches to avoid rate limiting
    
    for (let i = 0; i < tracksToResolve.length; i += batchSize) {
        const batch = tracksToResolve.slice(i, Math.min(i + batchSize, tracksToResolve.length));
        
        console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(tracksToResolve.length/batchSize)}`);
        console.log('-'.repeat(40));
        
        const batchPromises = batch.map(async (track, idx) => {
            const batchIndex = i + idx + 1;
            console.log(`\n[${batchIndex}/${tracksToResolve.length}] Resolving track...`);
            console.log(`  Feed GUID: ${track.feedGuid}`);
            console.log(`  Item GUID: ${track.itemGuid}`);
            
            // Try multiple resolution methods
            let episode = await fetchByRemoteItem(track.feedGuid, track.itemGuid);
            
            if (!episode) {
                // Try without feedGuid
                episode = await fetchEpisodeByGuid(track.itemGuid);
            }
            
            if (episode) {
                // Update track with resolved metadata
                track.title = episode.title || track.title;
                track.artist = episode.feedTitle || episode.author || 'Unknown Artist';
                track.album = episode.feedTitle || 'Unknown Album';
                track.artwork = episode.image || episode.feedImage || track.artwork;
                track.audioUrl = episode.enclosureUrl || track.audioUrl;
                track.duration = episode.duration || 0;
                track.description = episode.description || track.description;
                track.pubDate = episode.datePublished ? new Date(episode.datePublished * 1000).toISOString() : track.pubDate;
                
                // Add additional metadata
                track.episodeId = episode.id;
                track.feedId = episode.feedId;
                track.feedTitle = episode.feedTitle;
                track.explicit = episode.explicit;
                track.episodeType = episode.episodeType;
                
                // Remove resolution flag
                delete track.needsResolution;
                
                console.log(`  ✅ Resolved: ${track.title} by ${track.artist}`);
                resolvedCount++;
            } else {
                console.log(`  ⚠️  Could not resolve metadata`);
                failedCount++;
            }
        });
        
        await Promise.all(batchPromises);
        
        // Save progress after each batch
        musicData.metadata.lastUpdated = new Date().toISOString();
        fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
        
        // Rate limiting delay between batches
        if (i + batchSize < tracksToResolve.length) {
            console.log('\n⏳ Waiting before next batch...');
            await delay(1000); // 1 second delay between batches
        }
    }
    
    // Final save
    musicData.metadata.lastResolution = {
        date: new Date().toISOString(),
        resolved: resolvedCount,
        failed: failedCount,
        source: 'IAM Playlist Resolution'
    };
    
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log('\n' + '=' .repeat(50));
    console.log('📊 Resolution Summary:');
    console.log(`  ✅ Resolved: ${resolvedCount} tracks`);
    console.log(`  ⚠️  Failed: ${failedCount} tracks`);
    console.log(`  📚 Total tracks in database: ${musicData.musicTracks.length}`);
    
    if (failedCount > 0) {
        console.log('\n💡 Some tracks could not be resolved. They may:');
        console.log('  - Not exist in the Podcast Index yet');
        console.log('  - Have different GUIDs in the index');
        console.log('  - Be from private or unlisted feeds');
    }
    
    console.log('\n✨ Metadata resolution complete!');
}

// Run the resolution
resolveRemoteItems().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});