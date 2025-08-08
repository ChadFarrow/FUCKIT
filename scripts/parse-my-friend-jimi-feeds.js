#!/usr/bin/env node

/**
 * Parse My Friend Jimi Feeds Script
 * 
 * This script parses the newly added My Friend Jimi album feeds
 * and updates the parsed-feeds.json file.
 */

const fs = require('fs');
const path = require('path');

// My Friend Jimi album feeds that were just added
const myFriendJimiFeeds = [
  "my-friend-jimi-b220b396-0ebe-4760-8294-4bb27e06eabf",
  "my-friend-jimi-e3f0086f-5ee2-4ead-ba9d-78a9a29acac8",
  "my-friend-jimi-6c539346-f58e-4480-9276-32da31368f8e",
  "my-friend-jimi-76407adf-773c-4eb2-b5e2-8aef137d781f",
  "my-friend-jimi-6e236029-d72e-48a4-8d0b-aecf78d39e87",
  "my-friend-jimi-b6d8f17c-f448-4085-8ce2-8b247eb26e63",
  "my-friend-jimi-2b5b26a9-3b7a-4f78-9db2-424d94b182d8",
  "my-friend-jimi-ed3d6bdf-011b-4416-ab87-591672c07145",
  "my-friend-jimi-3d8c7279-6aa6-41e7-be1c-2680e57af6c8",
  "my-friend-jimi-86061a0e-52df-4cad-8c6d-cd1e19ca1e63"
];

async function parseMyFriendJimiFeeds() {
  console.log('🔄 Parsing My Friend Jimi album feeds...\n');
  
  try {
    // Load the feeds.json
    const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
    const feedsData = JSON.parse(fs.readFileSync(feedsPath, 'utf8'));
    
    // Load the parsed-feeds.json
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
    
    // Find the My Friend Jimi feeds
    const myFriendJimiFeedData = feedsData.feeds.filter(feed => 
      myFriendJimiFeeds.includes(feed.id)
    );
    
    console.log(`📋 Found ${myFriendJimiFeedData.length} My Friend Jimi feeds to parse\n`);
    
    let parsedCount = 0;
    
    for (const feed of myFriendJimiFeedData) {
      console.log(`🔍 Parsing: ${feed.title} (${feed.id})`);
      console.log(`   URL: ${feed.originalUrl}`);
      
      try {
        // Fetch the feed
        const response = await fetch(feed.originalUrl);
        
        if (!response.ok) {
          console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
          continue;
        }
        
        const text = await response.text();
        console.log(`   ✅ Response received (${text.length} characters)`);
        
        // Simple parsing to extract basic info
        const titleMatch = text.match(/<title[^>]*>(.*?)<\/title>/i);
        const artistMatch = text.match(/<itunes:author[^>]*>(.*?)<\/itunes:author>/i);
        const descriptionMatch = text.match(/<description[^>]*>(.*?)<\/description>/i);
        const imageMatch = text.match(/<itunes:image[^>]*href=["']([^"']+)["'][^>]*>/i);
        
        const title = titleMatch ? titleMatch[1].replace(/<\!\[CDATA\[(.*?)\]\]>/, '$1').trim() : feed.title;
        const artist = artistMatch ? artistMatch[1].replace(/<\!\[CDATA\[(.*?)\]\]>/, '$1').trim() : 'My Friend Jimi';
        const description = descriptionMatch ? descriptionMatch[1].replace(/<\!\[CDATA\[(.*?)\]\]>/, '$1').trim() : 'My Friend Jimi';
        const coverArt = imageMatch ? imageMatch[1] : null;
        
        // Extract tracks
        const trackMatches = text.match(/<item[^>]*>.*?<title[^>]*>(.*?)<\/title>.*?<enclosure[^>]*url=["']([^"']+)["'][^>]*>.*?<\/item>/gs);
        const tracks = [];
        
        if (trackMatches) {
          trackMatches.forEach((match, index) => {
            const trackTitleMatch = match.match(/<title[^>]*>(.*?)<\/title>/i);
            const trackUrlMatch = match.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*>/i);
            
            if (trackTitleMatch && trackUrlMatch) {
              const trackTitle = trackTitleMatch[1].replace(/<\!\[CDATA\[(.*?)\]\]>/, '$1').trim();
              const trackUrl = trackUrlMatch[1];
              
              tracks.push({
                title: trackTitle,
                duration: "0:00", // We don't have duration info
                url: trackUrl,
                trackNumber: index + 1,
                explicit: false
              });
            }
          });
        }
        
        // Create parsed data
        const parsedData = {
          album: {
            title: title,
            artist: artist,
            description: description,
            coverArt: coverArt,
            tracks: tracks,
            releaseDate: new Date().toISOString(),
            link: feed.originalUrl,
            summary: description,
            explicit: false,
            owner: {
              name: "Wavlake",
              email: "contact@wavlake.com"
            },
            publisher: {
              feedGuid: "0ea699be-e985-4aa1-8c00-43542e4b9e0d",
              feedUrl: "https://wavlake.com/feed/artist/0ea699be-e985-4aa1-8c00-43542e4b9e0d",
              medium: "publisher"
            }
          }
        };
        
        // Update the feed in parsed-feeds.json
        const existingFeedIndex = parsedFeedsData.feeds.findIndex(f => f.id === feed.id);
        
        if (existingFeedIndex >= 0) {
          parsedFeedsData.feeds[existingFeedIndex] = {
            ...feed,
            parseStatus: "success",
            lastParsed: new Date().toISOString(),
            parsedData: parsedData,
            trackCount: tracks.length
          };
        } else {
          parsedFeedsData.feeds.push({
            ...feed,
            parseStatus: "success",
            lastParsed: new Date().toISOString(),
            parsedData: parsedData,
            trackCount: tracks.length
          });
        }
        
        console.log(`   ✅ Parsed: ${title} (${tracks.length} tracks)`);
        if (coverArt) {
          console.log(`   🖼️  Cover Art: ${coverArt}`);
        }
        
        parsedCount++;
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`   ❌ Error parsing: ${error.message}`);
      }
      
      console.log('');
    }
    
    // Save the updated parsed-feeds.json
    fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
    
    console.log(`✅ Successfully parsed ${parsedCount} My Friend Jimi albums`);
    console.log('\n📝 Next steps:');
    console.log('1. Check the My Friend Jimi publisher page to see all albums');
    console.log('2. The publisher should now show all My Friend Jimi albums');
    
  } catch (error) {
    console.error('❌ Error parsing feeds:', error.message);
  }
}

// Run the script
parseMyFriendJimiFeeds(); 