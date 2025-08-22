#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { parseString } = require('xml2js');
const { promisify } = require('util');
const parseXml = promisify(parseString);

// Install xml2js if not available
try {
    require('xml2js');
} catch (e) {
    console.log('Installing xml2js...');
    require('child_process').execSync('npm install xml2js', { stdio: 'inherit' });
}

const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
const publisherIndexPath = path.join(__dirname, '..', 'data', 'publisher-feeds-index.json');

console.log('Loading existing data...');
const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
const publisherIndex = JSON.parse(fs.readFileSync(publisherIndexPath, 'utf8'));

// Create a set of existing publisher mappings
const existingMappings = new Set();
publisherIndex.forEach(entry => {
    existingMappings.add(entry.albumFeedUrl);
    if (entry.albumGuid) {
        existingMappings.add(`https://wavlake.com/feed/music/${entry.albumGuid}`);
    }
});

// Fetch feed content
async function fetchFeed(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const timeout = setTimeout(() => {
            reject(new Error('Request timeout'));
        }, 10000);

        protocol.get(url, (res) => {
            clearTimeout(timeout);
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

// Parse Wavlake feeds to extract publisher info
async function extractWavlakePublisher(feedUrl) {
    try {
        // For Wavlake, try to fetch the feed and look for publisher info
        const feedContent = await fetchFeed(feedUrl);
        const parsed = await parseXml(feedContent);
        
        if (parsed.rss && parsed.rss.channel) {
            const channel = parsed.rss.channel[0];
            
            // Look for podcast:person tag with role="artist"
            if (channel['podcast:person']) {
                const person = channel['podcast:person'].find(p => 
                    p.$ && p.$.role === 'artist'
                );
                if (person && person.$ && person.$.href) {
                    // Extract publisher GUID from artist URL
                    const match = person.$.href.match(/\/artist\/([a-f0-9-]+)/);
                    if (match) {
                        return {
                            publisherFeedGuid: match[1],
                            publisherFeedUrl: `https://wavlake.com/feed/artist/${match[1]}`
                        };
                    }
                }
            }
            
            // Look for itunes:author as fallback
            if (channel['itunes:author']) {
                const author = channel['itunes:author'][0];
                // Try to find this artist in existing mappings
                const existingArtist = musicData.musicTracks.find(t => 
                    t.artist === author && t.publisherFeedGuid
                );
                if (existingArtist) {
                    return {
                        publisherFeedGuid: existingArtist.publisherFeedGuid,
                        publisherFeedUrl: existingArtist.publisherFeedUrl
                    };
                }
            }
        }
    } catch (error) {
        console.error(`Error fetching ${feedUrl}: ${error.message}`);
    }
    return null;
}

// Manual mappings for known publishers
const manualMappings = {
    'https://www.doerfelverse.com': {
        publisherFeedGuid: 'doerfelverse-publisher',
        publisherFeedUrl: 'https://www.doerfelverse.com/feeds/publisher.xml'
    },
    'https://files.heycitizen.xyz': {
        publisherFeedGuid: 'heycitizen-publisher',
        publisherFeedUrl: 'https://files.heycitizen.xyz/publisher.xml'
    },
    'https://music.behindthesch3m3s.com': {
        publisherFeedGuid: 'behindtheschemes-publisher',
        publisherFeedUrl: 'https://music.behindthesch3m3s.com/publisher.xml'
    },
    'https://www.sirtjthewrathful.com': {
        publisherFeedGuid: 'sirtjthewrathful-publisher',
        publisherFeedUrl: 'https://www.sirtjthewrathful.com/publisher.xml'
    },
    'https://hogstory.net': {
        publisherFeedGuid: 'hogstory-publisher',
        publisherFeedUrl: 'https://hogstory.net/publisher.xml'
    }
};

async function processFeeds() {
    const tracksToUpdate = musicData.musicTracks.filter(t => !t.publisherFeedGuid);
    const feedGroups = {};
    
    // Group tracks by feed URL
    tracksToUpdate.forEach(track => {
        if (!feedGroups[track.feedUrl]) {
            feedGroups[track.feedUrl] = [];
        }
        feedGroups[track.feedUrl].push(track);
    });
    
    console.log(`\nProcessing ${Object.keys(feedGroups).length} unique feeds...`);
    
    let newMappings = [];
    let updatedTracks = 0;
    
    for (const [feedUrl, tracks] of Object.entries(feedGroups)) {
        process.stdout.write(`\rProcessing: ${feedUrl.substring(0, 50)}...`);
        
        let publisherInfo = null;
        
        // Check manual mappings first
        const domain = feedUrl.match(/https?:\/\/([^\/]+)/)?.[1];
        const domainBase = domain ? `https://${domain}` : null;
        
        if (domainBase && manualMappings[domainBase]) {
            publisherInfo = manualMappings[domainBase];
        } else if (feedUrl.includes('wavlake.com')) {
            // Try to fetch Wavlake feed for publisher info
            publisherInfo = await extractWavlakePublisher(feedUrl);
        }
        
        if (publisherInfo) {
            // Update all tracks from this feed
            tracks.forEach(track => {
                track.publisherFeedGuid = publisherInfo.publisherFeedGuid;
                track.publisherFeedUrl = publisherInfo.publisherFeedUrl;
                updatedTracks++;
            });
            
            // Add to publisher index if not exists
            if (!existingMappings.has(feedUrl)) {
                const albumGuid = feedUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/)?.[1];
                newMappings.push({
                    albumFeedUrl: feedUrl,
                    albumGuid: albumGuid || feedUrl,
                    albumTitle: tracks[0].album || tracks[0].feedTitle,
                    publisherFeedGuid: publisherInfo.publisherFeedGuid,
                    publisherFeedUrl: publisherInfo.publisherFeedUrl
                });
            }
        }
        
        // Small delay to avoid overwhelming servers
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n\nUpdated ${updatedTracks} tracks with publisher info`);
    console.log(`Added ${newMappings.length} new publisher mappings`);
    
    // Update publisher index
    if (newMappings.length > 0) {
        publisherIndex.push(...newMappings);
        fs.writeFileSync(publisherIndexPath, JSON.stringify(publisherIndex, null, 2));
    }
    
    // Save updated music data
    const backupPath = musicTracksPath + `.backup-${Date.now()}`;
    fs.copyFileSync(musicTracksPath, backupPath);
    fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
    
    // Final statistics
    const totalTracks = musicData.musicTracks.length;
    const tracksWithPublisher = musicData.musicTracks.filter(t => t.publisherFeedGuid).length;
    const stillMissing = totalTracks - tracksWithPublisher;
    
    console.log('\n' + '='.repeat(50));
    console.log('PUBLISHER FEED UPDATE COMPLETE');
    console.log('='.repeat(50));
    console.log(`Total tracks: ${totalTracks}`);
    console.log(`Tracks with publisher: ${tracksWithPublisher} (${(tracksWithPublisher/totalTracks*100).toFixed(1)}%)`);
    console.log(`Still missing: ${stillMissing} tracks`);
    
    if (stillMissing > 0) {
        // Show breakdown of remaining gaps
        const remaining = musicData.musicTracks.filter(t => !t.publisherFeedGuid);
        const domains = {};
        remaining.forEach(t => {
            const domain = t.feedUrl?.match(/https?:\/\/([^\/]+)/)?.[1] || 'unknown';
            domains[domain] = (domains[domain] || 0) + 1;
        });
        
        console.log('\nRemaining gaps by domain:');
        Object.entries(domains)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([domain, count]) => {
                console.log(`  - ${domain}: ${count} tracks`);
            });
    }
}

// Run the processor
processFeeds().catch(console.error);