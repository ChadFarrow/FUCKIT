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
        'User-Agent': 'FUCKIT-HGH-Feed-Test/1.0'
    };
}

async function testHghMainFeed() {
    console.log('🏠 Testing Homegrown Hits Main Feed Lookup\n');
    console.log('=' .repeat(60) + '\n');
    
    // The main HGH feed GUID we found from the XML
    const mainFeedGuid = 'ac746d09-7c3b-5bcd-b28a-f12d6456ca8f';
    
    console.log(`🔍 Looking up main HGH feed: ${mainFeedGuid}\n`);
    
    try {
        const headers = generateAuthHeaders();
        
        // Test 1: Look up by GUID
        console.log('1️⃣ **TESTING FEED LOOKUP BY GUID**');
        const url = `${API_BASE}/podcasts/byguid?guid=${mainFeedGuid}`;
        console.log(`   🔗 Testing: ${url}`);
        
        const response = await fetch(url, { headers });
        const data = await response.json();
        
        console.log(`   📊 Status: ${data.status}`);
        console.log(`   📝 Description: ${data.description}`);
        
        if (data.status === 'true' || data.status === true) {
            const feed = Array.isArray(data.feed) ? data.feed[0] : data.feed;
            if (feed) {
                console.log(`   ✅ Found main feed: "${feed.title}" by ${feed.author || 'Unknown'}`);
                console.log(`   📡 Feed ID: ${feed.id}`);
                console.log(`   📱 Medium: ${feed.medium || 'not specified'}`);
                console.log(`   🎨 Artwork: ${feed.artwork ? '✅' : '❌'}`);
                console.log(`   🌐 URL: ${feed.url}`);
                
                // Test 2: Get episodes from this feed
                console.log('\n2️⃣ **TESTING EPISODES FROM MAIN FEED**');
                const episodeUrl = `${API_BASE}/episodes/byfeedid?id=${feed.id}&max=5`;
                console.log(`   🔗 Testing: ${episodeUrl}`);
                
                const episodeResponse = await fetch(episodeUrl, { headers });
                const episodeData = await episodeResponse.json();
                
                console.log(`   📊 Status: ${episodeData.status}`);
                if (episodeData.status === 'true' || episodeData.status === true) {
                    const episodes = episodeData.items || [];
                    console.log(`   ✅ Found ${episodes.length} episodes`);
                    
                    if (episodes.length > 0) {
                        console.log(`\n   📀 Sample Episode:`);
                        const ep = episodes[0];
                        console.log(`      Title: ${ep.title}`);
                        console.log(`      GUID: ${ep.guid}`);
                        console.log(`      ID: ${ep.id}`);
                        console.log(`      Duration: ${ep.duration || 'not specified'}`);
                        console.log(`      Enclosure: ${ep.enclosureUrl ? '✅' : '❌'}`);
                    }
                }
                
                // Test 3: Look up some sample remote feed GUIDs from the playlist
                console.log('\n3️⃣ **TESTING SAMPLE REMOTE FEED GUIDS**');
                const sampleGuids = [
                    '54c84531-b98d-6529-d922-5235b579008b',
                    '80eec020-5fa3-6f98-2d9e-644cc211743d',
                    'acd2ebc8-1e4b-93e9-3ecb-5df4367b4028'
                ];
                
                for (const [index, guid] of sampleGuids.entries()) {
                    console.log(`   🔍 [${index + 1}/3] Testing remote GUID: ${guid}`);
                    
                    const remoteUrl = `${API_BASE}/podcasts/byguid?guid=${guid}`;
                    const remoteResponse = await fetch(remoteUrl, { headers });
                    const remoteData = await remoteResponse.json();
                    
                    if (remoteData.status === 'true' || remoteData.status === true) {
                        const remoteFeed = Array.isArray(remoteData.feed) ? remoteData.feed[0] : remoteData.feed;
                        if (remoteFeed) {
                            console.log(`      ✅ Found: "${remoteFeed.title}" by ${remoteFeed.author || 'Unknown'}`);
                            console.log(`      📱 Medium: ${remoteFeed.medium || 'not specified'}`);
                        } else {
                            console.log(`      ❌ Response had true status but no feed data`);
                        }
                    } else {
                        console.log(`      ❌ Not found: ${remoteData.description || 'Unknown error'}`);
                    }
                    
                    // Rate limit
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
            } else {
                console.log(`   ❌ Response had true status but no feed data`);
            }
        } else {
            console.log(`   ❌ Main feed not found: ${data.description || 'Unknown error'}`);
        }
        
        console.log('\n' + '=' .repeat(60));
        console.log('💡 **ANALYSIS:**\n');
        console.log('This test will help us understand:');
        console.log('1. Is the main Homegrown Hits feed indexed in Podcast Index?');
        console.log('2. Are the remote item feed GUIDs accessible in the index?'); 
        console.log('3. What is the correct approach for resolving these items?');
        
    } catch (error) {
        console.error('❌ Error testing HGH feed:', error.message);
        process.exit(1);
    }
}

// Run the test
testHghMainFeed();