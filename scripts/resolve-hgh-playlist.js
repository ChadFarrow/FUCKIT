#!/usr/bin/env node

/**
 * Resolve HGH playlist references from the actual playlist feed
 */

const fs = require('fs');
const path = require('path');

async function resolveHGHPlaylist() {
    try {
        console.log('🔍 Resolving HGH playlist from source feed...\n');
        
        // Import enhanced RSS parser
        const { enhancedRSSParser } = await import('../lib/enhanced-rss-parser.ts');
        
        if (!enhancedRSSParser) {
            console.log('❌ Enhanced RSS parser not available');
            return;
        }
        
        const playlistUrl = 'https://raw.githubusercontent.com/ChadFarrow/chadf-musicl-playlists/refs/heads/main/docs/HGH-music-playlist.xml';
        
        console.log(`📡 Parsing HGH playlist feed: ${playlistUrl}`);
        
        // Parse the playlist feed
        const playlistData = await enhancedRSSParser.parseAlbumFeed(playlistUrl, {
            useEnhanced: true,
            includePodcastIndex: true,
            resolveRemoteItems: true,
            extractValueForValue: true
        });
        
        if (!playlistData || !playlistData.tracks) {
            console.log('❌ Failed to parse HGH playlist feed');
            return;
        }
        
        console.log(`✅ Found ${playlistData.tracks.length} tracks in HGH playlist\n`);
        
        // Load the main music tracks database
        const musicDbPath = path.join(process.cwd(), 'data', 'music-tracks.json');
        const musicData = JSON.parse(fs.readFileSync(musicDbPath, 'utf8'));
        
        // Filter HGH tracks from our database
        const hghTracks = musicData.musicTracks.filter(track => 
            track.source && track.source.includes('HGH')
        );
        
        console.log(`Found ${hghTracks.length} HGH placeholder tracks to resolve\n`);
        
        // Create a mapping between playlist tracks and placeholder tracks
        const resolvedTracks = [];
        const unresolvedTracks = [];
        
        // Group HGH tracks by their feedGuid for matching
        const hghByFeedGuid = new Map();
        hghTracks.forEach((track, index) => {
            const originalIndex = musicData.musicTracks.indexOf(track);
            if (track.feedGuid) {
                if (!hghByFeedGuid.has(track.feedGuid)) {
                    hghByFeedGuid.set(track.feedGuid, []);
                }
                hghByFeedGuid.get(track.feedGuid).push({
                    track,
                    originalIndex
                });
            }
        });
        
        console.log(`📋 Playlist tracks sample:`);
        playlistData.tracks.slice(0, 10).forEach((track, i) => {
            console.log(`  ${i + 1}. "${track.title}" by ${track.feedArtist || track.artist || 'Unknown'}`);
            console.log(`     Feed: ${track.feedTitle || track.album || 'Unknown'}`);
            console.log(`     GUID: ${track.feedGuid || 'None'}`);
            console.log();
        });
        
        // Try to match playlist tracks with HGH placeholders
        playlistData.tracks.forEach(playlistTrack => {
            if (playlistTrack.feedGuid && hghByFeedGuid.has(playlistTrack.feedGuid)) {
                const hghMatches = hghByFeedGuid.get(playlistTrack.feedGuid);
                
                // Take the first match (they should all be the same feed)
                const hghMatch = hghMatches[0];
                
                // Create resolved track with playlist data
                const resolvedTrack = {
                    ...hghMatch.track,
                    title: playlistTrack.title || hghMatch.track.title,
                    feedTitle: playlistTrack.feedTitle || playlistTrack.album || 'HGH Playlist',
                    feedArtist: playlistTrack.feedArtist || playlistTrack.artist || 'Various Artists',
                    feedDescription: playlistTrack.summary || playlistTrack.description || 'Track from HGH Music Playlist',
                    feedUrl: playlistTrack.feedUrl || playlistUrl,
                    feedImage: playlistTrack.feedImage || playlistTrack.image,
                    duration: playlistTrack.duration || hghMatch.track.duration,
                    itemGuid: playlistTrack.itemGuid || { _: playlistTrack.guid || hghMatch.track.feedGuid },
                    resolvedAt: new Date().toISOString(),
                    resolutionSource: 'hgh-playlist-feed',
                    originalSource: hghMatch.track.source
                };
                
                resolvedTracks.push({
                    originalIndex: hghMatch.originalIndex,
                    resolved: resolvedTrack,
                    playlistTrack
                });
            }
        });
        
        // Find unresolved HGH tracks
        const resolvedGuids = new Set(resolvedTracks.map(r => r.resolved.feedGuid));
        hghTracks.forEach((track, index) => {
            if (!resolvedGuids.has(track.feedGuid)) {
                unresolvedTracks.push({
                    originalIndex: musicData.musicTracks.indexOf(track),
                    track
                });
            }
        });
        
        console.log(`📊 Resolution Results:`);
        console.log(`Successfully resolved: ${resolvedTracks.length} tracks`);
        console.log(`Still unresolved: ${unresolvedTracks.length} tracks\n`);
        
        if (resolvedTracks.length > 0) {
            console.log(`✅ Sample resolved tracks:`);
            resolvedTracks.slice(0, 10).forEach((item, i) => {
                const track = item.resolved;
                console.log(`  ${i + 1}. "${track.title}"`);
                console.log(`     Artist: "${track.feedArtist}"`);
                console.log(`     Album: "${track.feedTitle}"`);
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
                hghPlaylistResolution: {
                    date: new Date().toISOString(),
                    resolvedTracks: resolvedTracks.length,
                    unresolvedTracks: unresolvedTracks.length,
                    playlistUrl,
                    totalPlaylistTracks: playlistData.tracks.length
                }
            };
            
            // Create backup
            const backupPath = path.join(process.cwd(), 'data', `music-tracks-backup-hgh-playlist-${Date.now()}.json`);
            fs.writeFileSync(backupPath, JSON.stringify(musicData, null, 2));
            console.log(`📋 Backup created: ${path.basename(backupPath)}`);
            
            // Save updated database
            fs.writeFileSync(musicDbPath, JSON.stringify(musicData, null, 2));
            console.log('✅ Database updated with resolved HGH playlist tracks');
            
        } else {
            console.log('⚠️ No tracks were resolved - database not modified');
        }
        
        if (unresolvedTracks.length > 0) {
            console.log(`\n❓ Sample unresolved tracks (may need manual review):`);
            unresolvedTracks.slice(0, 5).forEach((item, i) => {
                console.log(`  ${i + 1}. "${item.track.title}" (GUID: ${item.track.feedGuid})`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error resolving HGH playlist:', error);
    }
}

// Run the resolution
resolveHGHPlaylist();