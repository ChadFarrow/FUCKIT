#!/usr/bin/env node

/**
 * Parse Death by Lions Single Track Script
 * 
 * This script parses the Death by Lions single track feed
 */

const fs = require('fs');
const path = require('path');

async function parseDeathByLionsSingle() {
  console.log('🔄 Parsing Death by Lions single track feed...\n');
  
  try {
    // Load the feeds.json
    const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
    const feedsData = JSON.parse(fs.readFileSync(feedsPath, 'utf8'));
    
    // Load the parsed-feeds.json
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
    
    // Find the Death by Lions single track feed
    const singleFeed = feedsData.feeds.find(feed => 
      feed.id === "death-by-lions-i-guess-this-will-have-to-do-single"
    );
    
    if (!singleFeed) {
      console.log('❌ Death by Lions single track feed not found in feeds.json');
      return;
    }
    
    console.log(`🔍 Parsing: ${singleFeed.title} (${singleFeed.id})`);
    console.log(`   URL: ${singleFeed.originalUrl}`);
    
    try {
      // Fetch the feed
      const response = await fetch(singleFeed.originalUrl);
      
      if (!response.ok) {
        console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
        return;
      }
      
      const text = await response.text();
      console.log(`   ✅ Response received (${text.length} characters)`);
      
      // Parse the feed content
      const titleMatch = text.match(/<title[^>]*>(.*?)<\/title>/i);
      const artistMatch = text.match(/<itunes:author[^>]*>(.*?)<\/itunes:author>/i);
      const descriptionMatch = text.match(/<description[^>]*>(.*?)<\/description>/i);
      const imageMatch = text.match(/<itunes:image[^>]*href=["']([^"']+)["'][^>]*>/i);
      const guidMatch = text.match(/<podcast:guid[^>]*>(.*?)<\/podcast:guid>/i);
      
      const title = titleMatch ? titleMatch[1].trim() : singleFeed.title;
      const artist = artistMatch ? artistMatch[1].trim() : 'Death by Lions';
      const description = descriptionMatch ? descriptionMatch[1].trim() : 'The music video from Death by Lions';
      const coverArt = imageMatch ? imageMatch[1] : null;
      const guid = guidMatch ? guidMatch[1].trim() : null;
      
      // Extract track information
      const trackTitleMatch = text.match(/<item[^>]*>.*?<title[^>]*>(.*?)<\/title>/i);
      const trackUrlMatch = text.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*>/i);
      const durationMatch = text.match(/<itunes:duration[^>]*>(.*?)<\/itunes:duration>/i);
      const pubDateMatch = text.match(/<pubDate[^>]*>(.*?)<\/pubDate>/i);
      
      const trackTitle = trackTitleMatch ? trackTitleMatch[1].trim() : title;
      const trackUrl = trackUrlMatch ? trackUrlMatch[1] : null;
      const duration = durationMatch ? durationMatch[1].trim() : "0:00";
      const pubDate = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();
      
      // Create tracks array
      const tracks = [];
      if (trackTitle && trackUrl) {
        tracks.push({
          title: trackTitle,
          duration: duration,
          url: trackUrl,
          trackNumber: 1,
          explicit: false
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
          releaseDate: pubDate,
          link: singleFeed.originalUrl,
          summary: description,
          explicit: false,
          owner: {
            name: "Death By Lions",
            email: ""
          },
          publisher: {
            feedGuid: "1e7f8807-31a7-454c-b612-f2563ba4cf67",
            feedUrl: "https://wavlake.com/feed/artist/1e7f8807-31a7-454c-b612-f2563ba4cf67",
            medium: "publisher"
          }
        }
      };
      
      // Update the feed in parsed-feeds.json
      const existingFeedIndex = parsedFeedsData.feeds.findIndex(f => f.id === singleFeed.id);
      
      if (existingFeedIndex >= 0) {
        parsedFeedsData.feeds[existingFeedIndex] = {
          ...singleFeed,
          parseStatus: "success",
          lastParsed: new Date().toISOString(),
          parsedData: parsedData,
          trackCount: tracks.length
        };
      } else {
        parsedFeedsData.feeds.push({
          ...singleFeed,
          parseStatus: "success",
          lastParsed: new Date().toISOString(),
          parsedData: parsedData,
          trackCount: tracks.length
        });
      }
      
      // Save the updated parsed-feeds.json
      fs.writeFileSync(parsedFeedsPath, JSON.stringify(parsedFeedsData, null, 2));
      
      console.log(`   ✅ Parsed: ${title} (${tracks.length} tracks)`);
      if (coverArt) {
        console.log(`   🖼️  Cover Art: ${coverArt}`);
      }
      console.log(`   🎵 Track:`);
      tracks.forEach(track => {
        console.log(`      - ${track.title} (${track.duration})`);
      });
      
      console.log(`\n✅ Successfully parsed Death by Lions single track`);
      console.log('\n📝 The single track is now available on the site!');
      
    } catch (error) {
      console.log(`   ❌ Error parsing: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error parsing feed:', error.message);
  }
}

// Run the script
parseDeathByLionsSingle(); 