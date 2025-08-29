#!/usr/bin/env node

/**
 * Fix missing artists in Wavlake feeds using enhanced RSS parsing and fallback techniques
 */

const fs = require('fs');
const path = require('path');

async function fixWavlakeArtists() {
    try {
        console.log('🔍 Fixing Wavlake artist metadata...\n');
        
        // Load the main music tracks database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        // Find Wavlake tracks with missing artists
        const wavlakeTracks = musicData.musicTracks.filter(track => 
            track.feedUrl && (
                track.feedUrl.includes('wavlake.com') || 
                track.feedUrl.includes('www.wavlake.com')
            ) && (
                !track.feedArtist || track.feedArtist.trim() === ''
            )
        );
        
        console.log(`Found ${wavlakeTracks.length} Wavlake tracks missing artist information\n`);
        
        if (wavlakeTracks.length === 0) {
            console.log('✅ No Wavlake tracks need artist fixes');
            return;
        }
        
        // Import enhanced RSS parser
        let enhancedParser = null;
        try {
            const { createRSSParser } = await import('../src/lib/rss-parser-config.js');
            enhancedParser = createRSSParser();
        } catch (error) {
            console.log('⚠️ Enhanced RSS parser not available, using fallback methods');
        }
        
        // Group tracks by feed URL to minimize RSS requests
        const tracksByFeed = new Map();
        wavlakeTracks.forEach(track => {
            const feedUrl = track.feedUrl;
            const originalIndex = musicData.musicTracks.indexOf(track);
            
            if (!tracksByFeed.has(feedUrl)) {
                tracksByFeed.set(feedUrl, []);
            }
            tracksByFeed.get(feedUrl).push({ track, originalIndex });
        });
        
        console.log(`Processing ${tracksByFeed.size} unique Wavlake feeds\n`);
        
        const fixedTracks = [];
        const failedFeeds = [];
        let processedFeeds = 0;
        
        // Process feeds in batches
        const batchSize = 5;
        const feedEntries = [...tracksByFeed.entries()];
        
        for (let i = 0; i < feedEntries.length; i += batchSize) {
            const batch = feedEntries.slice(i, i + batchSize);
            
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(feedEntries.length / batchSize)} (${batch.length} feeds)...`);
            
            const batchPromises = batch.map(async ([feedUrl, tracks]) => {
                try {
                    processedFeeds++;
                    
                    let feedArtist = null;
                    let feedTitle = null;
                    
                    // Try enhanced RSS parsing first
                    if (enhancedParser) {
                        try {
                            const feedData = await enhancedParser.fetchAndParseFeed(feedUrl);
                            if (feedData && feedData.feed) {
                                feedArtist = feedData.feed.itunes?.author || feedData.feed.author || feedData.feed.title;
                                feedTitle = feedData.feed.title;
                            }
                        } catch (parseError) {
                            console.log(`⚠️ Enhanced parsing failed for ${feedUrl.substring(0, 50)}..., trying fallbacks`);
                        }
                    }
                    
                    // If enhanced parsing didn't work, try extracting from URL or track data
                    if (!feedArtist) {
                        // Extract artist from Wavlake URL pattern
                        const urlMatch = feedUrl.match(/wavlake\.com\/feed\/(?:music\/)?([a-f0-9-]{36})/);
                        if (urlMatch) {
                            // Try to extract from album/feed title if available
                            const firstTrack = tracks[0].track;
                            if (firstTrack.feedTitle && firstTrack.feedTitle.trim()) {
                                feedTitle = firstTrack.feedTitle;
                                feedArtist = firstTrack.feedTitle; // Use album as artist fallback
                            }
                        }
                        
                        // Try extracting artist from track titles using common patterns
                        if (!feedArtist) {
                            feedArtist = extractArtistFromTracks(tracks.map(t => t.track));
                        }
                        
                        // Final fallback - use "Wavlake Artist" 
                        if (!feedArtist) {
                            feedArtist = 'Wavlake Artist';
                        }
                    }
                    
                    if (feedArtist) {
                        console.log(`✅ Resolved "${feedArtist}" for ${tracks.length} tracks`);
                        
                        // Update all tracks from this feed
                        tracks.forEach(({ track, originalIndex }) => {
                            const fixedTrack = {
                                ...track,
                                feedArtist: feedArtist,
                                feedTitle: feedTitle || track.feedTitle || feedArtist,
                                fixedAt: new Date().toISOString(),
                                fixMethod: enhancedParser ? 'enhanced-rss-parsing' : 'pattern-extraction'
                            };
                            
                            fixedTracks.push({
                                originalIndex,
                                fixed: fixedTrack
                            });
                        });
                        
                        return { success: true, feedUrl, artist: feedArtist, trackCount: tracks.length };
                    } else {
                        console.log(`❌ Could not determine artist for ${feedUrl.substring(0, 50)}...`);
                        failedFeeds.push({ feedUrl, reason: 'No artist found' });
                        return { success: false, feedUrl };
                    }
                    
                } catch (error) {
                    console.log(`❌ Error processing ${feedUrl.substring(0, 50)}...: ${error.message}`);
                    failedFeeds.push({ feedUrl, reason: error.message });
                    return { success: false, feedUrl, error: error.message };
                }
            });
            
            // Wait for batch to complete
            await Promise.all(batchPromises);
            
            // Small delay between batches
            if (i + batchSize < feedEntries.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log(`\n📊 Fix Results:`);
        console.log(`Processed feeds: ${processedFeeds}`);
        console.log(`Successfully fixed: ${fixedTracks.length} tracks`);
        console.log(`Failed feeds: ${failedFeeds.length}\n`);
        
        if (fixedTracks.length > 0) {
            console.log(`✅ Sample fixed tracks:`);
            fixedTracks.slice(0, 10).forEach((item, i) => {
                const track = item.fixed;
                console.log(`  ${i + 1}. "${track.title}"`);
                console.log(`     Artist: "${track.feedArtist}" (${track.fixMethod})`);
                console.log(`     Feed: ${track.feedUrl.substring(0, 60)}...`);
                console.log();
            });
            
            // Apply fixes to the database
            console.log('💾 Applying fixes to database...');
            fixedTracks.forEach(({ originalIndex, fixed }) => {
                musicData.musicTracks[originalIndex] = fixed;
            });
            
            // Update metadata
            musicData.metadata = {
                ...musicData.metadata,
                lastUpdated: new Date().toISOString(),
                wavlakeArtistFix: {
                    date: new Date().toISOString(),
                    fixedTracks: fixedTracks.length,
                    failedFeeds: failedFeeds.length,
                    processedFeeds
                }
            };
            
            // Create backup
            const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-wavlake-fix-${Date.now()}.json`);
            fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
            console.log(`📋 Backup created: ${path.basename(backupPath)}`);
            
            // Save updated database
            fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
            console.log('✅ Database updated with Wavlake artist fixes');
            
        } else {
            console.log('⚠️ No tracks were fixed - database not modified');
        }
        
    } catch (error) {
        console.error('❌ Error fixing Wavlake artists:', error);
    }
}

/**
 * Extract artist from track collection using common patterns
 */
function extractArtistFromTracks(tracks) {
    // Look for common patterns in track titles
    const patterns = [
        // "Artist - Song" pattern
        /^([^-]+)\s*-\s*.+$/,
        // "Song by Artist" pattern  
        /^.+\s+by\s+(.+)$/i,
        // "Song (Artist)" pattern
        /^.+\s*\(([^)]+)\)$/
    ];
    
    for (const track of tracks) {
        const title = track.title || '';
        
        for (const pattern of patterns) {
            const match = title.match(pattern);
            if (match && match[1]) {
                const artist = match[1].trim();
                if (artist.length > 2 && artist.length < 50) {
                    return artist;
                }
            }
        }
    }
    
    // If we have a feed title that looks like an artist name, use it
    const feedTitle = tracks[0]?.feedTitle;
    if (feedTitle && feedTitle.trim() && !feedTitle.toLowerCase().includes('untitled')) {
        return feedTitle.trim();
    }
    
    return null;
}

// Run the fix
fixWavlakeArtists();