#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
const publisherIndexPath = path.join(__dirname, '..', 'data', 'publisher-feeds-index.json');

console.log('Loading existing data...');
const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
const publisherIndex = JSON.parse(fs.readFileSync(publisherIndexPath, 'utf8'));

// Strategy 1: Use artist-based matching with fuzzy logic
function findPublisherByArtist(track) {
    if (!track.artist) return null;
    
    const normalizedArtist = track.artist.toLowerCase().trim();
    
    // Look for exact matches first
    for (const otherTrack of musicData.musicTracks) {
        if (otherTrack.publisherFeedGuid && 
            otherTrack.artist?.toLowerCase().trim() === normalizedArtist) {
            return {
                publisherFeedGuid: otherTrack.publisherFeedGuid,
                publisherFeedUrl: otherTrack.publisherFeedUrl
            };
        }
    }
    
    // Try partial matches (for variations like "Artist Name" vs "Artist Name Band")
    for (const otherTrack of musicData.musicTracks) {
        if (otherTrack.publisherFeedGuid && otherTrack.artist) {
            const otherArtist = otherTrack.artist.toLowerCase().trim();
            if (normalizedArtist.includes(otherArtist) || otherArtist.includes(normalizedArtist)) {
                return {
                    publisherFeedGuid: otherTrack.publisherFeedGuid,
                    publisherFeedUrl: otherTrack.publisherFeedUrl
                };
            }
        }
    }
    
    return null;
}

// Strategy 2: Generate synthetic publisher IDs for consistent feeds
function generatePublisherForFeed(feedUrl, tracks) {
    const domain = feedUrl?.match(/https?:\/\/([^\/]+)/)?.[1] || 'unknown';
    
    // For non-Wavlake feeds, create a synthetic publisher
    if (!feedUrl?.includes('wavlake.com')) {
        // Use consistent artist if all tracks have same artist
        const artists = [...new Set(tracks.map(t => t.artist).filter(Boolean))];
        const artist = artists.length === 1 ? artists[0] : null;
        
        if (artist) {
            // Create a consistent publisher ID based on domain and artist
            const publisherId = `${domain.replace(/\./g, '-')}-${artist.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
            return {
                publisherFeedGuid: publisherId,
                publisherFeedUrl: `synthetic://${domain}/artist/${encodeURIComponent(artist)}`
            };
        } else {
            // Use feed-based publisher ID
            const feedHash = feedUrl.split('/').pop().replace(/[^a-z0-9-]/gi, '') || 'feed';
            return {
                publisherFeedGuid: `${domain.replace(/\./g, '-')}-${feedHash}`,
                publisherFeedUrl: `synthetic://${domain}/feed/${feedHash}`
            };
        }
    }
    
    return null;
}

// Strategy 3: Fix Wavlake feeds with malformed URLs
function fixWavlakeFeed(track) {
    if (track.feedUrl?.includes('wavlake.com')) {
        // Extract GUID from various URL formats
        const guidPatterns = [
            /\/feed\/music\/([a-f0-9-]{36})/i,
            /\/feed\/([a-f0-9-]{36})/i,
            /\/([a-f0-9-]{36})$/i
        ];
        
        for (const pattern of guidPatterns) {
            const match = track.feedUrl.match(pattern);
            if (match) {
                // Check if we have this album in our index
                for (const entry of publisherIndex) {
                    if (entry.albumGuid === match[1]) {
                        return {
                            publisherFeedGuid: entry.publisherFeedGuid,
                            publisherFeedUrl: entry.publisherFeedUrl
                        };
                    }
                }
                
                // If not in index, create synthetic publisher
                return {
                    publisherFeedGuid: `wavlake-unknown-${match[1].substring(0, 8)}`,
                    publisherFeedUrl: `synthetic://wavlake.com/artist/unknown-${match[1].substring(0, 8)}`
                };
            }
        }
    }
    return null;
}

console.log('\nApplying intelligent gap-filling strategies...');

let stats = {
    artistMatched: 0,
    syntheticCreated: 0,
    wavlakeFixed: 0,
    total: 0
};

// Group tracks by feed
const feedGroups = {};
musicData.musicTracks.forEach(track => {
    if (!track.publisherFeedGuid) {
        if (!feedGroups[track.feedUrl]) {
            feedGroups[track.feedUrl] = [];
        }
        feedGroups[track.feedUrl].push(track);
    }
});

// Process each group
for (const [feedUrl, tracks] of Object.entries(feedGroups)) {
    let publisherInfo = null;
    let strategy = '';
    
    // Try artist matching first
    for (const track of tracks) {
        publisherInfo = findPublisherByArtist(track);
        if (publisherInfo) {
            strategy = 'artist';
            stats.artistMatched += tracks.length;
            break;
        }
    }
    
    // Try Wavlake fix
    if (!publisherInfo && feedUrl?.includes('wavlake.com')) {
        publisherInfo = fixWavlakeFeed(tracks[0]);
        if (publisherInfo) {
            strategy = 'wavlake';
            stats.wavlakeFixed += tracks.length;
        }
    }
    
    // Generate synthetic publisher as last resort
    if (!publisherInfo) {
        publisherInfo = generatePublisherForFeed(feedUrl, tracks);
        if (publisherInfo) {
            strategy = 'synthetic';
            stats.syntheticCreated += tracks.length;
        }
    }
    
    // Apply the publisher info to all tracks in the group
    if (publisherInfo) {
        tracks.forEach(track => {
            track.publisherFeedGuid = publisherInfo.publisherFeedGuid;
            track.publisherFeedUrl = publisherInfo.publisherFeedUrl;
            track.publisherStrategy = strategy; // Track which strategy was used
            stats.total++;
        });
    }
}

// Create backup and save
const backupPath = musicTracksPath + `.backup-${Date.now()}`;
console.log(`\nCreating backup at ${backupPath}`);
fs.copyFileSync(musicTracksPath, backupPath);

console.log('Writing updated database...');
fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));

// Generate final report
const totalTracks = musicData.musicTracks.length;
const tracksWithPublisher = musicData.musicTracks.filter(t => t.publisherFeedGuid).length;
const stillMissing = totalTracks - tracksWithPublisher;

console.log('\n' + '='.repeat(50));
console.log('FINAL GAP FILLING COMPLETE');
console.log('='.repeat(50));

console.log('\n📊 STRATEGIES USED:');
console.log(`  • Artist matching: ${stats.artistMatched} tracks`);
console.log(`  • Wavlake fixes: ${stats.wavlakeFixed} tracks`);
console.log(`  • Synthetic publishers: ${stats.syntheticCreated} tracks`);
console.log(`  • Total filled: ${stats.total} tracks`);

console.log('\n📈 FINAL DATABASE STATUS:');
console.log(`  • Total tracks: ${totalTracks}`);
console.log(`  • Tracks with publisher: ${tracksWithPublisher} (${(tracksWithPublisher/totalTracks*100).toFixed(1)}%)`);
console.log(`  • Remaining without publisher: ${stillMissing}`);

// Check for any edge cases
const syntheticCount = musicData.musicTracks.filter(t => 
    t.publisherFeedUrl?.startsWith('synthetic://')).length;
if (syntheticCount > 0) {
    console.log(`\n📝 NOTE: ${syntheticCount} tracks use synthetic publisher IDs`);
    console.log('  These are placeholder IDs for feeds without proper publisher info.');
}

if (stillMissing > 0) {
    console.log('\n⚠️  MANUAL REVIEW NEEDED:');
    const remaining = musicData.musicTracks.filter(t => !t.publisherFeedGuid);
    console.log(`  ${remaining.length} tracks could not be resolved automatically`);
    console.log('\n  Sample unresolved tracks:');
    remaining.slice(0, 5).forEach(t => {
        console.log(`    - ${t.artist || 'Unknown'} - ${t.title} (${t.feedUrl})`);
    });
}

console.log('\n✅ Database optimization complete!');