#!/usr/bin/env node

/**
 * Resolve HGH playlist references using Podcast Index API
 */

const fs = require('fs');
const path = require('path');

// Import the enhanced RSS parser for Podcast Index API access
async function resolveHGHReferences() {
    try {
        console.log('🔍 Starting HGH reference resolution...\n');
        
        // Load the main music tracks database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        // Filter HGH tracks
        const hghTracks = musicData.musicTracks.filter(track => 
            track.source && track.source.includes('HGH')
        );
        
        console.log(`Found ${hghTracks.length} HGH tracks to resolve\n`);
        
        // Import enhanced RSS parser
        const { createRSSParser } = await import('../src/lib/rss-parser-config.js');
        const rssParser = createRSSParser();
        
        if (!rssParser) {
            console.log('❌ Enhanced RSS parser not available - cannot resolve HGH tracks');
            return;
        }
        
        console.log('✅ Enhanced RSS parser available - proceeding with resolution\n');
        
        // Group by feedGuid to minimize API calls
        const feedGuids = new Map();
        hghTracks.forEach((track, index) => {
            const feedGuid = track.feedGuid;
            if (feedGuid) {
                if (!feedGuids.has(feedGuid)) {
                    feedGuids.set(feedGuid, []);
                }
                feedGuids.get(feedGuid).push({
                    track,
                    originalIndex: musicData.musicTracks.indexOf(track)
                });
            }
        });
        
        console.log(`Found ${feedGuids.size} unique feed GUIDs to resolve\n`);
        
        const resolvedTracks = [];
        const failedFeeds = [];
        let processedFeeds = 0;
        
        // Process feeds in batches to respect API limits
        const batchSize = 5;
        const feedGuidEntries = [...feedGuids.entries()];
        
        for (let i = 0; i < feedGuidEntries.length; i += batchSize) {
            const batch = feedGuidEntries.slice(i, i + batchSize);
            
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(feedGuidEntries.length / batchSize)} (${batch.length} feeds)...`);
            
            const batchPromises = batch.map(async ([feedGuid, tracks]) => {
                try {
                    // Look up feed by GUID
                    const feedData = await rssParser.lookupByFeedGuid(feedGuid);
                    processedFeeds++;
                    
                    if (feedData && feedData.feed) {
                        const feed = feedData.feed;
                        console.log(`✅ Resolved feed: ${feed.title} by ${feed.author || 'Unknown Artist'}`);
                        
                        // Update all tracks for this feed
                        tracks.forEach(({ track, originalIndex }) => {
                            const resolvedTrack = {
                                ...track,
                                feedTitle: feed.title,
                                feedArtist: feed.author || feed.title || 'Unknown Artist',
                                feedDescription: feed.description || '',
                                feedUrl: feed.url,
                                feedImage: feed.image,
                                resolvedAt: new Date().toISOString(),
                                resolutionSource: 'podcast-index-api'
                            };
                            
                            resolvedTracks.push({
                                originalIndex,
                                resolved: resolvedTrack
                            });
                        });
                        
                        return { success: true, feedGuid, feed: feed.title };
                    } else {
                        console.log(`⚠️ No data found for feed GUID: ${feedGuid}`);
                        failedFeeds.push({ feedGuid, reason: 'No data returned' });
                        return { success: false, feedGuid, reason: 'No data returned' };
                    }
                    
                } catch (error) {
                    console.log(`❌ Failed to resolve feed GUID ${feedGuid}: ${error.message}`);
                    failedFeeds.push({ feedGuid, reason: error.message });
                    return { success: false, feedGuid, reason: error.message };
                }
            });
            
            // Wait for batch to complete
            await Promise.all(batchPromises);
            
            // Small delay between batches to be respectful
            if (i + batchSize < feedGuidEntries.length) {
                console.log('Waiting 2 seconds before next batch...\n');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log(`\n📊 Resolution Results:`);
        console.log(`Processed feeds: ${processedFeeds}`);
        console.log(`Successfully resolved: ${resolvedTracks.length} tracks`);
        console.log(`Failed resolutions: ${failedFeeds.length} feeds`);
        
        if (resolvedTracks.length > 0) {
            console.log(`\n✅ Sample resolved tracks:`);
            resolvedTracks.slice(0, 10).forEach((item, i) => {
                const track = item.resolved;
                console.log(`  ${i + 1}. "${track.title}"`);
                console.log(`     Artist: "${track.feedArtist}"`);
                console.log(`     Album: "${track.feedTitle}"`);
                console.log(`     Feed URL: ${track.feedUrl}`);
                console.log();
            });
            
            // Apply the resolved data to the original database
            console.log('💾 Applying resolved data to database...');
            resolvedTracks.forEach(({ originalIndex, resolved }) => {
                musicData.musicTracks[originalIndex] = resolved;
            });
            
            // Update metadata
            musicData.metadata = {
                ...musicData.metadata,
                lastUpdated: new Date().toISOString(),
                hghResolutionRun: {
                    date: new Date().toISOString(),
                    resolvedTracks: resolvedTracks.length,
                    failedFeeds: failedFeeds.length,
                    totalProcessed: processedFeeds
                }
            };
            
            // Create backup
            const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-hgh-resolution-${Date.now()}.json`);
            fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
            console.log(`📋 Backup created: ${backupPath}`);
            
            // Save updated database
            fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
            console.log('✅ Database updated with resolved HGH tracks');
            
        } else {
            console.log('⚠️ No tracks were resolved - database not modified');
        }
        
        if (failedFeeds.length > 0) {
            console.log(`\n❌ Failed feed resolutions:`);
            failedFeeds.slice(0, 10).forEach(({ feedGuid, reason }, i) => {
                console.log(`  ${i + 1}. ${feedGuid}: ${reason}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error resolving HGH references:', error);
    }
}

// Run the resolution
resolveHGHReferences();