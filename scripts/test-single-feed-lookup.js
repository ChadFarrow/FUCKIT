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

function generateAuthHeaders() {
    const authTime = Math.floor(Date.now() / 1000);
    const authString = API_KEY + API_SECRET + authTime;
    const authHeader = crypto.createHash('sha1').update(authString).digest('hex');
    
    return {
        'X-Auth-Key': API_KEY,
        'X-Auth-Date': authTime,
        'Authorization': authHeader,
        'User-Agent': 'FUCKIT-Test/1.0'
    };
}

async function testFeedLookup() {
    // Test with one of the feed GUIDs
    const testFeedGuid = '75f0b434-19dc-5959-9920-0fb5304be61b';
    
    console.log(`Testing feed GUID: ${testFeedGuid}`);
    console.log('This GUID appears multiple times in the playlist\n');
    
    const headers = generateAuthHeaders();
    
    // Try different endpoints
    const endpoints = [
        `/podcasts/byguid?guid=${testFeedGuid}`,
        `/podcasts/byfeedid?id=${testFeedGuid}`,
        `/search/byterm?q=${testFeedGuid}`,
        `/search/music/byterm?q=music`  // Try searching for music feeds
    ];
    
    for (const endpoint of endpoints) {
        console.log(`\nTrying: ${endpoint}`);
        try {
            const url = API_BASE + endpoint;
            const response = await fetch(url, { headers });
            const data = await response.json();
            
            console.log(`Status: ${data.status}`);
            console.log(`Description: ${data.description || 'N/A'}`);
            
            if (data.feed) {
                console.log('✅ Found feed:', {
                    id: data.feed.id,
                    title: data.feed.title,
                    author: data.feed.author,
                    url: data.feed.url
                });
            } else if (data.feeds && data.feeds.length > 0) {
                console.log(`✅ Found ${data.feeds.length} feeds`);
                data.feeds.slice(0, 3).forEach(feed => {
                    console.log('  -', feed.title, '|', feed.author);
                });
            } else {
                console.log('❌ No results');
            }
        } catch (error) {
            console.log('❌ Error:', error.message);
        }
    }
    
    // Try to search for music feeds specifically
    console.log('\n\n=== Searching for Music Feeds ===');
    try {
        const url = `${API_BASE}/search/music/byterm?q=music`;
        const response = await fetch(url, { headers });
        const data = await response.json();
        
        if (data.feeds && data.feeds.length > 0) {
            console.log(`Found ${data.feeds.length} music feeds`);
            
            // Check if any match our GUIDs
            const ourGuids = ['75f0b434-19dc-5959-9920-0fb5304be61b', '2b62ef49-fcff-523c-b81a-0a7dde2b0609', '70b4915d-0c0b-5f7a-9980-82831d2a9ba2'];
            
            data.feeds.forEach(feed => {
                if (feed.guid && ourGuids.includes(feed.guid)) {
                    console.log('🎯 MATCH FOUND!', feed.title, feed.guid);
                }
            });
        }
    } catch (error) {
        console.log('Error searching music:', error.message);
    }
}

testFeedLookup();