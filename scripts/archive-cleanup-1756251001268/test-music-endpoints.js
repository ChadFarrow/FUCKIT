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
        'User-Agent': 'FUCKIT-Music-Endpoint-Test/1.0'
    };
}

async function testMusicEndpoints() {
    console.log('🎵 Testing Podcast Index Music-Specific Endpoints\n');
    console.log('=' .repeat(60) + '\n');
    
    console.log('🔍 **WHY WE MIGHT BE MISSING MUSIC TRACKS:**\n');
    console.log('Our previous scripts used general podcast search endpoints.');
    console.log('The Podcast Index has MUSIC-SPECIFIC endpoints that we didn\'t try!\n');
    
    const headers = generateAuthHeaders();
    
    // Test 1: /search/music/byterm endpoint
    console.log('1️⃣ **TESTING /search/music/byterm ENDPOINT**');
    console.log('   This endpoint searches only music-medium feeds\n');
    
    try {
        const url = `${API_BASE}/search/music/byterm?q=music&max=10`;
        console.log(`   🔗 Testing: ${url}`);
        
        const response = await fetch(url, { headers });
        const data = await response.json();
        
        console.log(`   📊 Status: ${data.status}`);
        console.log(`   📝 Description: ${data.description}`);
        
        if (data.feeds && data.feeds.length > 0) {
            console.log(`   ✅ Found ${data.feeds.length} music feeds!\n`);
            
            console.log('   🎵 **SAMPLE MUSIC FEEDS:**');
            data.feeds.slice(0, 5).forEach((feed, i) => {
                console.log(`   ${i+1}. "${feed.title}" by ${feed.author || 'Unknown'}`);
                console.log(`      📡 GUID: ${feed.guid || feed.id}`);
                console.log(`      🎨 Artwork: ${feed.artwork ? '✅' : '❌'}`);
                console.log(`      📱 Medium: ${feed.medium || 'not specified'}\n`);
            });
        } else {
            console.log('   ❌ No music feeds found\n');
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
    }
    
    // Test 2: /podcasts/bymedium endpoint
    console.log('2️⃣ **TESTING /podcasts/bymedium ENDPOINT**');
    console.log('   This endpoint gets ALL feeds with medium=music\n');
    
    try {
        const url = `${API_BASE}/podcasts/bymedium?medium=music&max=10`;
        console.log(`   🔗 Testing: ${url}`);
        
        const response = await fetch(url, { headers });
        const data = await response.json();
        
        console.log(`   📊 Status: ${data.status}`);
        console.log(`   📝 Description: ${data.description}`);
        
        if (data.feeds && data.feeds.length > 0) {
            console.log(`   ✅ Found ${data.feeds.length} music-medium feeds!\n`);
            
            console.log('   🎵 **SAMPLE MUSIC-MEDIUM FEEDS:**');
            data.feeds.slice(0, 5).forEach((feed, i) => {
                console.log(`   ${i+1}. "${feed.title}" by ${feed.author || 'Unknown'}`);
                console.log(`      📡 GUID: ${feed.guid || feed.id}`);
                console.log(`      🎨 Artwork: ${feed.artwork ? '✅' : '❌'}`);
                console.log(`      📱 Medium: ${feed.medium}\n`);
            });
        } else {
            console.log('   ❌ No music-medium feeds found\n');
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
    }
    
    // Test 3: Compare with our missing feed GUIDs
    console.log('3️⃣ **TESTING OUR MISSING FEED GUIDS**');
    console.log('   Let\'s see if any of our "missing" feeds are actually music feeds\n');
    
    // Load our database to check some feed GUIDs that failed
    const musicTracksPath = path.join(__dirname, '..', 'data', 'music-tracks.json');
    const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
    
    // Find some feed GUIDs that we couldn't resolve
    const failedFeeds = [];
    const seenGuids = new Set();
    
    musicData.musicTracks.forEach(track => {
        if (track.feedGuid && 
            (track.title?.startsWith('Track ') || track.title === 'Unindexed Music Track') &&
            !seenGuids.has(track.feedGuid)) {
            failedFeeds.push(track.feedGuid);
            seenGuids.add(track.feedGuid);
        }
    });
    
    console.log(`   📊 Testing ${Math.min(failedFeeds.length, 3)} previously failed feed GUIDs:\n`);
    
    for (const [index, feedGuid] of failedFeeds.slice(0, 3).entries()) {
        console.log(`   🔍 [${index + 1}/3] Testing GUID: ${feedGuid}`);
        
        // Try the music search first
        try {
            const url = `${API_BASE}/podcasts/byguid?guid=${feedGuid}`;
            const response = await fetch(url, { headers });
            const data = await response.json();
            
            if (data.status === 'true' || data.status === true) {
                const feed = Array.isArray(data.feed) ? data.feed[0] : data.feed;
                if (feed) {
                    console.log(`      ✅ Found feed: "${feed.title}" by ${feed.author || 'Unknown'}`);
                    console.log(`      📱 Medium: ${feed.medium || 'not specified'}`);
                    console.log(`      🎨 Has artwork: ${feed.artwork ? '✅' : '❌'}`);
                    
                    if (feed.medium === 'music') {
                        console.log(`      🎵 **THIS IS A MUSIC FEED WE MISSED!**`);
                    }
                } else {
                    console.log(`      ❌ Feed not found in index`);
                }
            } else {
                console.log(`      ❌ API returned status: ${data.status}`);
            }
        } catch (error) {
            console.log(`      ❌ Error: ${error.message}`);
        }
        console.log('');
    }
    
    console.log('=' .repeat(60));
    console.log('💡 **DISCOVERY SUMMARY:**\n');
    
    console.log('🔍 **Why LNBeats finds more music than our scripts:**');
    console.log('1. They likely use /search/music/byterm for music-specific searches');
    console.log('2. They may use /podcasts/bymedium to browse all music feeds');
    console.log('3. They understand the medium="music" tag system');
    console.log('4. They may have better feed GUID resolution strategies\n');
    
    console.log('🚀 **Next Steps to Find More Music:**');
    console.log('1. Use /search/music/byterm for discovering new music feeds');
    console.log('2. Use /podcasts/bymedium?medium=music to get ALL music feeds');
    console.log('3. Re-check our "failed" feeds - some may actually exist');
    console.log('4. Look for feeds with medium="music" tag specifically\n');
    
    console.log('✨ **The Podcast Index HAS more music - we just need to query it correctly!**');
}

// Run the test
testMusicEndpoints().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});