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
        'User-Agent': 'FUCKIT-Metadata-Enhancer/1.0'
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

async function getEpisodeByGuid(itemGuid, feedGuid = null) {
    try {
        const headers = generateAuthHeaders();
        let url = `${API_BASE}/episodes/byguid?guid=${encodeURIComponent(itemGuid)}`;
        if (feedGuid) {
            url += `&feedguid=${feedGuid}`;
        }
        
        const response = await fetch(url, { headers });
        const data = await response.json();
        
        if (data.status === 'true' || data.status === true && data.episode) {
            return data.episode;
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function getAudioMetadata(audioUrl) {
    if (!audioUrl || !audioUrl.startsWith('http')) {
        return null;
    }
    
    try {
        // Make a HEAD request to get content info without downloading
        const response = await fetch(audioUrl, { 
            method: 'HEAD',
            headers: {
                'User-Agent': 'FUCKIT-Metadata-Enhancer/1.0'
            }
        });
        
        if (!response.ok) return null;
        
        const contentLength = response.headers.get('content-length');
        const contentType = response.headers.get('content-type');
        
        // Estimate duration from file size for audio files (rough estimate)
        if (contentLength && contentType && contentType.includes('audio')) {
            const sizeInMB = parseInt(contentLength) / (1024 * 1024);
            // Rough estimate: 1MB = ~1 minute for typical podcast audio quality
            const estimatedDuration = Math.round(sizeInMB * 60);
            
            if (estimatedDuration > 0 && estimatedDuration < 7200) { // Max 2 hours seems reasonable
                return {
                    estimatedDuration: estimatedDuration,
                    fileSize: contentLength,
                    contentType: contentType
                };
            }
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

function parseDurationString(durationStr) {
    if (!durationStr) return 0;
    
    // Handle HH:MM:SS or MM:SS format
    if (typeof durationStr === 'string') {
        const parts = durationStr.split(':').map(p => parseInt(p)).filter(p => !isNaN(p));
        if (parts.length === 3) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
        } else if (parts.length === 2) {
            return parts[0] * 60 + parts[1]; // MM:SS
        }
    }
    
    // Handle numeric duration (already in seconds)
    if (typeof durationStr === 'number' && durationStr > 0) {
        return Math.round(durationStr);
    }
    
    return 0;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function enhanceMissingMetadata() {
    console.log('🎨 Enhanced Metadata Resolution for Missing Artwork and Duration\n');
    console.log('=' .repeat(60) + '\n');
    
    // Load music tracks
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Create backup
    const backupPath = musicTracksPath + `.backup-enhance-metadata-${Date.now()}`;
    console.log(`📦 Creating backup at ${path.basename(backupPath)}\n`);
    fs.copyFileSync(musicTracksPath, backupPath);
    
    // Find tracks that need enhancement
    const tracksNeedingArtwork = musicData.musicTracks.filter(track => 
        !track.artwork || 
        track.artwork === '' || 
        track.artwork === '/api/placeholder/300/300'
    );
    
    const tracksNeedingDuration = musicData.musicTracks.filter(track => 
        !track.duration || 
        track.duration === 0 || 
        track.duration === '0' ||
        typeof track.duration === 'string' // Duration strings like "00:03:09" need conversion
    );
    
    console.log(`📊 Enhancement Analysis:`);
    console.log(`  🎨 Tracks needing artwork: ${tracksNeedingArtwork.length}`);
    console.log(`  ⏱️  Tracks needing duration: ${tracksNeedingDuration.length}`);
    
    // Get tracks that need both or either
    const tracksToEnhance = new Set([...tracksNeedingArtwork, ...tracksNeedingDuration]);
    console.log(`  🎯 Total tracks to enhance: ${tracksToEnhance.size}\n`);
    
    if (tracksToEnhance.size === 0) {
        console.log('✅ All tracks already have complete metadata!');
        return;
    }
    
    // Group tracks by feed GUID for efficient processing
    const feedGroups = {};
    const tracksWithoutFeed = [];
    
    for (const track of tracksToEnhance) {
        if (track.feedGuid) {
            const feedGuid = track.feedGuid;
            if (!feedGroups[feedGuid]) {
                feedGroups[feedGuid] = [];
            }
            feedGroups[feedGuid].push(track);
        } else {
            tracksWithoutFeed.push(track);
        }
    }
    
    const uniqueFeeds = Object.keys(feedGroups).length;
    console.log(`📊 Processing Strategy:`);
    console.log(`  📁 ${uniqueFeeds} feeds with multiple tracks`);
    console.log(`  🎵 ${tracksWithoutFeed.length} individual tracks without feed info\n`);
    
    let artworkEnhanced = 0;
    let durationEnhanced = 0;
    let bothEnhanced = 0;
    let feedIndex = 0;
    
    // Cache for feed data to avoid repeated API calls
    const feedCache = {};
    const episodeCache = {};
    
    // Process feed groups first (most efficient)
    for (const [feedGuid, tracks] of Object.entries(feedGroups)) {
        feedIndex++;
        console.log(`📁 [${feedIndex}/${uniqueFeeds}] Processing Feed: ${feedGuid}`);
        console.log(`   Tracks to enhance: ${tracks.length}`);
        
        let feed = null;
        let episodes = [];
        
        // Check cache first
        if (feedCache[feedGuid]) {
            feed = feedCache[feedGuid];
            episodes = episodeCache[feedGuid] || [];
            console.log(`   ✨ Using cached feed data: ${feed.title || 'Unknown'}`);
        } else {
            // Fetch feed information
            console.log('   🔍 Looking up feed...');
            feed = await getFeedByGuid(feedGuid);
            
            if (feed && feed.id) {
                feedCache[feedGuid] = feed;
                console.log(`   ✅ Found feed: "${feed.title || 'Unknown'}" by ${feed.author || 'Unknown'}`);
                
                // Fetch episodes for this feed
                console.log('   📚 Fetching episodes...');
                episodes = await getEpisodesByFeedId(feed.id);
                episodeCache[feedGuid] = episodes;
                console.log(`   ✅ Retrieved ${episodes.length} episodes`);
            } else {
                console.log('   ❌ Feed not found in Podcast Index');
            }
        }
        
        // Process each track in this feed group
        for (const [index, track] of tracks.entries()) {
            const needsArt = !track.artwork || track.artwork === '' || track.artwork === '/api/placeholder/300/300';
            const needsDuration = !track.duration || track.duration === 0 || track.duration === '0' || typeof track.duration === 'string';
            
            console.log(`\n   🎵 [${index + 1}/${tracks.length}] "${track.title}" by ${track.artist}`);
            console.log(`      Needs: ${needsArt ? '🎨 Art' : ''}${needsArt && needsDuration ? ' + ' : ''}${needsDuration ? '⏱️ Duration' : ''}`);
            
            let enhanced = false;
            
            if (feed && episodes.length > 0) {
                // Try to find specific episode
                let episode = null;
                const itemGuid = typeof track.itemGuid === 'string' ? track.itemGuid : track.itemGuid?._; 
                
                if (itemGuid) {
                    episode = episodes.find(ep => 
                        ep.guid === itemGuid ||
                        ep.id === itemGuid ||
                        (ep.enclosureUrl && ep.enclosureUrl.includes(itemGuid))
                    );
                }
                
                // If no specific episode found, try by title match
                if (!episode && track.title) {
                    episode = episodes.find(ep => 
                        ep.title && track.title && 
                        ep.title.toLowerCase().includes(track.title.toLowerCase().substring(0, 20))
                    );
                }
                
                if (episode) {
                    console.log(`      ✅ Found matching episode`);
                    
                    // Enhance artwork
                    if (needsArt) {
                        const newArtwork = episode.image || episode.feedImage || feed.image || feed.artwork;
                        if (newArtwork && newArtwork.startsWith('http')) {
                            track.artwork = newArtwork;
                            console.log(`      🎨 Updated artwork from episode`);
                            artworkEnhanced++;
                            enhanced = true;
                        }
                    }
                    
                    // Enhance duration
                    if (needsDuration) {
                        let newDuration = 0;
                        
                        // Try episode duration first
                        if (episode.duration && episode.duration > 0) {
                            newDuration = episode.duration;
                            console.log(`      ⏱️  Updated duration from episode: ${newDuration}s`);
                        } else if (track.duration && typeof track.duration === 'string') {
                            // Parse existing string duration
                            newDuration = parseDurationString(track.duration);
                            if (newDuration > 0) {
                                console.log(`      ⏱️  Parsed duration string: ${track.duration} -> ${newDuration}s`);
                            }
                        }
                        
                        // Try to estimate from audio file if we have URL but no duration
                        if (newDuration === 0 && episode.enclosureUrl) {
                            console.log(`      🔍 Attempting audio file analysis...`);
                            const audioMeta = await getAudioMetadata(episode.enclosureUrl);
                            if (audioMeta && audioMeta.estimatedDuration) {
                                newDuration = audioMeta.estimatedDuration;
                                console.log(`      ⏱️  Estimated duration from file: ${newDuration}s`);
                            }
                        }
                        
                        if (newDuration > 0) {
                            track.duration = newDuration;
                            durationEnhanced++;
                            enhanced = true;
                        }
                    }
                    
                    if (needsArt && needsDuration && enhanced) {
                        bothEnhanced++;
                    }
                } else if (feed) {
                    // Use feed-level artwork if available
                    if (needsArt) {
                        const feedArtwork = feed.image || feed.artwork;
                        if (feedArtwork && feedArtwork.startsWith('http')) {
                            track.artwork = feedArtwork;
                            console.log(`      🎨 Updated artwork from feed`);
                            artworkEnhanced++;
                            enhanced = true;
                        }
                    }
                }
                
                // Update audio URL if available and missing
                if (!track.audioUrl && episode && episode.enclosureUrl) {
                    track.audioUrl = episode.enclosureUrl;
                    console.log(`      🎧 Updated audio URL`);
                }
            }
            
            if (!enhanced) {
                console.log(`      ⚠️  Could not enhance metadata`);
            }
            
            // Small delay between tracks to be respectful
            await delay(100);
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
    
    // Process individual tracks without feed info
    if (tracksWithoutFeed.length > 0) {
        console.log(`\n📝 Processing ${tracksWithoutFeed.length} individual tracks...\n`);
        
        for (const [index, track] of tracksWithoutFeed.entries()) {
            const needsArt = !track.artwork || track.artwork === '' || track.artwork === '/api/placeholder/300/300';
            const needsDuration = !track.duration || track.duration === 0 || track.duration === '0' || typeof track.duration === 'string';
            
            console.log(`🎵 [${index + 1}/${tracksWithoutFeed.length}] "${track.title}" by ${track.artist}`);
            
            let enhanced = false;
            
            // Try to parse string duration if that's all we have
            if (needsDuration && track.duration && typeof track.duration === 'string') {
                const parsedDuration = parseDurationString(track.duration);
                if (parsedDuration > 0) {
                    track.duration = parsedDuration;
                    console.log(`   ⏱️  Parsed duration string: ${parsedDuration}s`);
                    durationEnhanced++;
                    enhanced = true;
                }
            }
            
            // Try audio file analysis if we have URL
            if (needsDuration && track.audioUrl && track.duration === 0) {
                console.log(`   🔍 Attempting audio file analysis...`);
                const audioMeta = await getAudioMetadata(track.audioUrl);
                if (audioMeta && audioMeta.estimatedDuration) {
                    track.duration = audioMeta.estimatedDuration;
                    console.log(`   ⏱️  Estimated duration: ${audioMeta.estimatedDuration}s`);
                    durationEnhanced++;
                    enhanced = true;
                }
            }
            
            if (!enhanced) {
                console.log(`   ⚠️  Could not enhance metadata`);
            }
            
            await delay(200);
        }
    }
    
    // Final save with summary
    musicData.metadata.lastMetadataEnhancement = {
        date: new Date().toISOString(),
        tracksProcessed: tracksToEnhance.size,
        artworkEnhanced: artworkEnhanced,
        durationEnhanced: durationEnhanced,
        bothEnhanced: bothEnhanced,
        source: 'Enhanced Metadata Resolution'
    };
    
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Enhancement Summary:');
    console.log(`  🎯 Tracks processed: ${tracksToEnhance.size}`);
    console.log(`  🎨 Artwork enhanced: ${artworkEnhanced} tracks`);
    console.log(`  ⏱️  Duration enhanced: ${durationEnhanced} tracks`);
    console.log(`  ✨ Both enhanced: ${bothEnhanced} tracks`);
    console.log(`  📚 Total tracks in database: ${musicData.musicTracks.length}`);
    
    const artworkRate = (artworkEnhanced / tracksNeedingArtwork.length * 100).toFixed(1);
    const durationRate = (durationEnhanced / tracksNeedingDuration.length * 100).toFixed(1);
    
    console.log(`\n  📈 Enhancement rates:`);
    console.log(`    🎨 Artwork: ${artworkEnhanced}/${tracksNeedingArtwork.length} (${artworkRate}%)`);
    console.log(`    ⏱️  Duration: ${durationEnhanced}/${tracksNeedingDuration.length} (${durationRate}%)`);
    
    console.log('\n✨ Metadata enhancement complete!');
    console.log('🎵 Your tracks should now have much better artwork and duration coverage.');
}

// Run the enhancement
enhanceMissingMetadata().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});