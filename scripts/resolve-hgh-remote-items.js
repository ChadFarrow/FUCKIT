#!/usr/bin/env node

/**
 * Resolve HGH remote items using the enhanced RSS parser
 */

const fs = require('fs');
const path = require('path');

async function resolveHGHRemoteItems() {
    try {
        console.log('🔍 Resolving HGH remote items...\n');
        
        // Import the RSS parser from src directory
        const { createRSSParser } = await import('../src/lib/rss-parser-config.js');
        const rssParser = createRSSParser();
        
        if (!rssParser) {
            console.log('❌ Enhanced RSS parser not available');
            return;
        }
        
        // Load the main music tracks database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        // Filter HGH tracks
        const hghTracks = musicData.musicTracks.filter(track => 
            track.source && track.source.includes('HGH')
        );
        
        console.log(`Found ${hghTracks.length} HGH tracks to resolve\n`);
        
        // Collect unique feedGuid+itemGuid pairs that need resolution
        const remoteItemsToResolve = new Set();
        const tracksByRemoteItem = new Map();
        
        hghTracks.forEach((track, index) => {
            const originalIndex = musicData.musicTracks.indexOf(track);
            
            if (track.feedGuid) {
                // For HGH tracks, we need to try resolving them as remote items
                // The feedGuid from HGH tracks should correspond to actual feeds with items
                const key = track.feedGuid;
                remoteItemsToResolve.add(key);
                
                if (!tracksByRemoteItem.has(key)) {
                    tracksByRemoteItem.set(key, []);
                }
                tracksByRemoteItem.get(key).push({
                    track,
                    originalIndex
                });
            }
        });
        
        console.log(`Found ${remoteItemsToResolve.size} unique feed GUIDs to resolve\n`);
        
        const resolvedTracks = [];
        const failedResolutions = [];
        let processedCount = 0;
        
        // Process remote items in smaller batches
        const batchSize = 3;
        const remoteItemsArray = [...remoteItemsToResolve];
        
        for (let i = 0; i < remoteItemsArray.length; i += batchSize) {
            const batch = remoteItemsArray.slice(i, i + batchSize);
            
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(remoteItemsArray.length / batchSize)} (${batch.length} items)...`);
            
            const batchPromises = batch.map(async (feedGuid) => {
                try {
                    processedCount++;
                    
                    // Try to resolve the remote item by looking up the feed
                    const feedData = await rssParser.lookupByFeedGuid(feedGuid);
                    
                    if (feedData && feedData.feed) {
                        const feed = feedData.feed;
                        console.log(`✅ Resolved feed: "${feed.title}" by ${feed.author || 'Unknown'}`);
                        
                        // Get the tracks that need this resolution
                        const tracksToUpdate = tracksByRemoteItem.get(feedGuid) || [];
                        
                        tracksToUpdate.forEach(({ track, originalIndex }) => {
                            const resolvedTrack = {
                                ...track,
                                title: track.title.replace(/^HGH (Featured )?Track \d+$/, feed.title) || track.title,
                                feedTitle: feed.title,
                                feedArtist: feed.author || 'Various Artists',
                                feedDescription: feed.description || 'From HGH Music Playlist',
                                feedUrl: feed.url,
                                feedImage: feed.image,
                                resolvedAt: new Date().toISOString(),
                                resolutionSource: 'podcast-index-feed-lookup',
                                originalSource: track.source
                            };
                            
                            resolvedTracks.push({
                                originalIndex,
                                resolved: resolvedTrack
                            });
                        });
                        
                        return { success: true, feedGuid, feed: feed.title };
                    } else {
                        console.log(`⚠️ No feed found for GUID: ${feedGuid}`);
                        failedResolutions.push({ feedGuid, reason: 'Feed not found in index' });
                        return { success: false, feedGuid };
                    }
                    
                } catch (error) {
                    console.log(`❌ Error resolving ${feedGuid}: ${error.message}`);
                    failedResolutions.push({ feedGuid, reason: error.message });
                    return { success: false, feedGuid, error: error.message };
                }
            });
            
            // Wait for batch to complete
            await Promise.all(batchPromises);
            
            // Small delay between batches
            if (i + batchSize < remoteItemsArray.length) {
                console.log('Waiting 2 seconds before next batch...\n');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log(`\n📊 Resolution Results:`);
        console.log(`Processed: ${processedCount} feed GUIDs`);
        console.log(`Successfully resolved: ${resolvedTracks.length} tracks`);
        console.log(`Failed resolutions: ${failedResolutions.length}\n`);
        
        if (resolvedTracks.length > 0) {
            console.log(`✅ Sample resolved tracks:`);
            resolvedTracks.slice(0, 10).forEach((item, i) => {
                const track = item.resolved;
                console.log(`  ${i + 1}. "${track.title}"`);
                console.log(`     Artist: "${track.feedArtist}"`);
                console.log(`     Feed: "${track.feedTitle}"`);
                console.log(`     Original: ${track.originalSource}`);
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
                hghRemoteItemResolution: {
                    date: new Date().toISOString(),
                    resolvedTracks: resolvedTracks.length,
                    failedResolutions: failedResolutions.length,
                    processedFeeds: processedCount
                }
            };
            
            // Create backup
            const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-hgh-remote-${Date.now()}.json`);
            fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
            console.log(`📋 Backup created: ${path.basename(backupPath)}`);
            
            // Save updated database
            fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
            console.log('✅ Database updated with resolved HGH remote items');
            
        } else {
            console.log('⚠️ No tracks were resolved - database not modified');
        }
        
        if (failedResolutions.length > 0 && failedResolutions.length < 20) {
            console.log(`\n❌ Failed resolutions:`);
            failedResolutions.forEach(({ feedGuid, reason }, i) => {
                console.log(`  ${i + 1}. ${feedGuid}: ${reason}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error resolving HGH remote items:', error);
    }
}

// Run the resolution
resolveHGHRemoteItems();