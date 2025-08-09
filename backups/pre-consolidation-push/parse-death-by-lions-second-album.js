#!/usr/bin/env node

/**
 * Parse Death by Lions Second Album Script
 * 
 * This script parses the second Death by Lions album feed
 */

const fs = require('fs');
const path = require('path');

async function parseDeathByLionsSecondAlbum() {
  console.log('🔄 Parsing Death by Lions second album...\n');
  
  try {
    // Load the feeds.json
    const feedsPath = path.join(process.cwd(), 'data', 'feeds.json');
    const feedsData = JSON.parse(fs.readFileSync(feedsPath, 'utf8'));
    
    // Load the parsed-feeds.json
    const parsedFeedsPath = path.join(process.cwd(), 'data', 'parsed-feeds.json');
    const parsedFeedsData = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
    
    // Find the second Death by Lions album feed
    const secondAlbumFeed = feedsData.feeds.find(feed => 
      feed.id === "death-by-lions-second-album"
    );
    
    if (!secondAlbumFeed) {
      console.log('❌ Death by Lions second album feed not found in feeds.json');
      return;
    }
    
    console.log(`🔍 Parsing: ${secondAlbumFeed.title} (${secondAlbumFeed.id})`);
    console.log(`   URL: ${secondAlbumFeed.originalUrl}`);
    
    try {
      // Fetch the feed
      const response = await fetch(secondAlbumFeed.originalUrl);
      
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
      const linkMatch = text.match(/<link[^>]*>(.*?)<\/link>/i);
      const lastBuildDateMatch = text.match(/<lastBuildDate[^>]*>(.*?)<\/lastBuildDate>/i);
      
      const title = titleMatch ? titleMatch[1].replace(/<\!\[CDATA\[(.*?)\]\]>/, '$1').trim() : secondAlbumFeed.title;
      const artist = artistMatch ? artistMatch[1].replace(/<\!\[CDATA\[(.*?)\]\]>/, '$1').trim() : 'Death by Lions';
      const description = descriptionMatch ? descriptionMatch[1].replace(/<\!\[CDATA\[(.*?)\]\]>/, '$1').trim() : 'Post hardcore band from Grand Rapids Michigan';
      const coverArt = imageMatch ? imageMatch[1] : null;
      const link = linkMatch ? linkMatch[1].trim() : secondAlbumFeed.originalUrl;
      const releaseDate = lastBuildDateMatch ? lastBuildDateMatch[1].trim() : new Date().toISOString();
      
      // Extract tracks
      const trackMatches = text.match(/<item[^>]*>.*?<title[^>]*>(.*?)<\/title>.*?<enclosure[^>]*url=["']([^"']+)["'][^>]*>.*?<\/item>/gs);
      const tracks = [];
      
      if (trackMatches) {
        trackMatches.forEach((match, index) => {
          const trackTitleMatch = match.match(/<title[^>]*>(.*?)<\/title>/i);
          const trackUrlMatch = match.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*>/i);
          const durationMatch = match.match(/<itunes:duration[^>]*>(.*?)<\/itunes:duration>/i);
          
          if (trackTitleMatch && trackUrlMatch) {
            const trackTitle = trackTitleMatch[1].replace(/<\!\[CDATA\[(.*?)\]\]>/, '$1').trim();
            const trackUrl = trackUrlMatch[1];
            const duration = durationMatch ? durationMatch[1].trim() : "0:00";
            
            tracks.push({
              title: trackTitle,
              duration: duration,
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
          releaseDate: releaseDate,
          link: link,
          summary: description,
          explicit: false,
          owner: {
            name: "Wavlake",
            email: "contact@wavlake.com"
          },
          publisher: {
            feedGuid: "1e7f8807-31a7-454c-b612-f2563ba4cf67",
            feedUrl: "https://wavlake.com/feed/artist/1e7f8807-31a7-454c-b612-f2563ba4cf67",
            medium: "publisher"
          }
        }
      };
      
      // Update the feed in parsed-feeds.json
      const existingFeedIndex = parsedFeedsData.feeds.findIndex(f => f.id === secondAlbumFeed.id);
      
      if (existingFeedIndex >= 0) {
        parsedFeedsData.feeds[existingFeedIndex] = {
          ...secondAlbumFeed,
          parseStatus: "success",
          lastParsed: new Date().toISOString(),
          parsedData: parsedData,
          trackCount: tracks.length
        };
      } else {
        parsedFeedsData.feeds.push({
          ...secondAlbumFeed,
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
      console.log(`   🎵 Tracks:`);
      tracks.forEach(track => {
        console.log(`      - ${track.title} (${track.duration})`);
      });
      
      console.log(`\n✅ Successfully parsed Death by Lions second album`);
      console.log('\n📝 The album is now available on the site!');
      
    } catch (error) {
      console.log(`   ❌ Error parsing: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error parsing feed:', error.message);
  }
}

// Run the script
parseDeathByLionsSecondAlbum(); 