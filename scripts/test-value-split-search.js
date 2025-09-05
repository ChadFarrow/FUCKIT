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
        'User-Agent': 'FUCKIT-ValueSplit-Test/1.0'
    };
}

async function testValueSplitSearch() {
    console.log('🎵 Testing Value Split Track Resolution\n');
    console.log('=' .repeat(60) + '\n');
    
    const headers = generateAuthHeaders();
    
    // Get a recent HGH episode to examine its value splits
    console.log('📻 Fetching recent HGH episode with value splits...\n');
    
    const hghFeedId = 6611624;
    const episodeUrl = `${API_BASE}/episodes/byfeedid?id=${hghFeedId}&max=1&fulltext`;
    
    try {
        const episodeResponse = await fetch(episodeUrl, { headers });
        const episodeData = await episodeResponse.json();
        
        if (episodeData.status === 'true' && episodeData.items && episodeData.items.length > 0) {
            const episode = episodeData.items[0];
            console.log(`📀 Latest HGH Episode: "${episode.title}"`);
            console.log(`🕒 Published: ${new Date(episode.datePublished * 1000).toLocaleDateString()}`);
            console.log(`⏱️  Duration: ${Math.floor(episode.duration / 60)}:${String(episode.duration % 60).padStart(2, '0')}`);
            
            // Check if episode has value splits
            if (episode.value && episode.value.timeSplits) {
                const timeSplits = episode.value.timeSplits;
                console.log(`💰 Value Splits: ${timeSplits.length}\n`);
                
                // Test the first few value splits
                const testSplits = timeSplits.slice(0, 3);
                
                for (const [index, split] of testSplits.entries()) {
                    console.log(`🎯 Value Split ${index + 1}:`);
                    console.log(`   Start Time: ${split.startTime}s`);
                    console.log(`   Duration: ${split.duration}s`);
                    console.log(`   Remote Percentage: ${split.remotePercentage}%`);
                    
                    if (split.remoteItem) {
                        const feedGuid = split.remoteItem.feedGuid;
                        const itemGuid = split.remoteItem.itemGuid;
                        
                        console.log(`   Feed GUID: ${feedGuid}`);
                        console.log(`   Item GUID: ${itemGuid}`);
                        
                        // Try to resolve this specific remote item
                        console.log(`   🔍 Searching for this remote item...`);
                        
                        // Direct feed lookup
                        const feedUrl = `${API_BASE}/podcasts/byguid?guid=${feedGuid}`;
                        const feedResponse = await fetch(feedUrl, { headers });
                        const feedData = await feedResponse.json();
                        
                        if (feedData.status === 'true' && feedData.feed) {
                            const feed = Array.isArray(feedData.feed) ? feedData.feed[0] : feedData.feed;
                            console.log(`      ✅ Found Feed: "${feed.title}" by ${feed.author}`);
                            console.log(`      📱 Medium: ${feed.medium}`);
                            console.log(`      🆔 Feed ID: ${feed.id}`);
                            
                            // Now try to find the specific item
                            const itemUrl = `${API_BASE}/episodes/byfeedid?id=${feed.id}&max=50`;
                            const itemResponse = await fetch(itemUrl, { headers });
                            const itemData = await itemResponse.json();
                            
                            if (itemData.status === 'true' && itemData.items) {
                                const matchedItem = itemData.items.find(item => 
                                    item.guid === itemGuid || item.id === itemGuid
                                );
                                
                                if (matchedItem) {
                                    console.log(`      ✅ Found Track: "${matchedItem.title}"`);
                                    console.log(`      🎵 Duration: ${Math.floor(matchedItem.duration / 60)}:${String(matchedItem.duration % 60).padStart(2, '0')}`);
                                    console.log(`      🔗 Audio: ${matchedItem.enclosureUrl ? '✅' : '❌'}`);
                                } else {
                                    console.log(`      ❌ Item not found in feed episodes`);
                                }
                            }
                        } else {
                            console.log(`      ❌ Feed not found: ${feedData.description}`);
                        }
                    }
                    
                    console.log('');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
            } else {
                console.log('❌ This episode has no value splits');
                
                // Let's check if we can find an episode with value splits
                console.log('\n🔍 Searching for HGH episodes with value splits...');
                
                const allEpisodesUrl = `${API_BASE}/episodes/byfeedid?id=${hghFeedId}&max=10&fulltext`;
                const allResponse = await fetch(allEpisodesUrl, { headers });
                const allData = await allResponse.json();
                
                if (allData.status === 'true' && allData.items) {
                    const episodesWithSplits = allData.items.filter(ep => 
                        ep.value && ep.value.timeSplits && ep.value.timeSplits.length > 0
                    );
                    
                    console.log(`📊 Episodes with value splits: ${episodesWithSplits.length}/${allData.items.length}`);
                    
                    if (episodesWithSplits.length > 0) {
                        const firstSplitEpisode = episodesWithSplits[0];
                        console.log(`\n📀 Episode with splits: "${firstSplitEpisode.title}"`);
                        console.log(`💰 Splits: ${firstSplitEpisode.value.timeSplits.length}`);
                        
                        // Test first split from this episode
                        const firstSplit = firstSplitEpisode.value.timeSplits[0];
                        if (firstSplit.remoteItem) {
                            console.log(`\n🎯 Testing first split:`);
                            console.log(`   Feed GUID: ${firstSplit.remoteItem.feedGuid}`);
                            console.log(`   Item GUID: ${firstSplit.remoteItem.itemGuid}`);
                            
                            // Test this one too
                            const testFeedUrl = `${API_BASE}/podcasts/byguid?guid=${firstSplit.remoteItem.feedGuid}`;
                            const testResponse = await fetch(testFeedUrl, { headers });
                            const testData = await testResponse.json();
                            
                            console.log(`   Result: ${testData.status} - ${testData.description}`);
                        }
                    }
                }
            }
            
        } else {
            console.log('❌ Could not fetch HGH episodes');
        }
        
        console.log('\n' + '=' .repeat(60));
        console.log('💡 Value Split Analysis Complete!');
        console.log('\nThis test shows us:');
        console.log('1. Whether HGH episodes actually have value splits in the API');
        console.log('2. If the remote items in value splits can be resolved');
        console.log('3. The actual structure of working remote item references');
        
    } catch (error) {
        console.error('❌ Error testing value splits:', error.message);
        process.exit(1);
    }
}

// Run the test
testValueSplitSearch();