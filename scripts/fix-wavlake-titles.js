const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

const prisma = new PrismaClient();

async function fixWavlakeTitles() {
  try {
    console.log('🔍 Finding feeds with generic Wavlake Album titles...');
    
    // Find all feeds with generic "Wavlake Album" titles
    const genericFeeds = await prisma.feed.findMany({
      where: {
        title: {
          startsWith: 'Wavlake Album'
        }
      },
      select: {
        id: true,
        title: true,
        originalUrl: true
      }
    });
    
    console.log(`📊 Found ${genericFeeds.length} feeds with generic Wavlake titles`);
    
    if (genericFeeds.length === 0) {
      console.log('✅ No generic Wavlake Album titles found!');
      return;
    }
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: false,
      trimValues: true
    });
    
    let fixed = 0;
    let errors = 0;
    
    for (const feed of genericFeeds) {
      try {
        console.log(`🔄 Processing ${feed.title} (${feed.originalUrl})`);
        
        // Fetch the RSS feed
        const response = await axios.get(feed.originalUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Music-Feed-Parser/1.0)'
          }
        });
        
        const rssData = parser.parse(response.data);
        const channel = rssData.rss?.channel || rssData.channel;
        
        if (!channel) {
          console.error(`❌ No channel found in RSS for ${feed.title}`);
          errors++;
          continue;
        }
        
        let actualTitle = channel.title;
        let artist = channel['itunes:author'] || channel.author || null;
        let description = channel.description || null;
        let image = null;
        
        // Extract image
        if (channel['itunes:image']) {
          image = channel['itunes:image']['@_href'];
        } else if (channel.image) {
          image = typeof channel.image === 'string' ? channel.image : channel.image.url;
        }
        
        if (!actualTitle || actualTitle.trim() === '') {
          console.error(`❌ No valid title found in RSS for ${feed.title}`);
          errors++;
          continue;
        }
        
        actualTitle = actualTitle.trim();
        
        console.log(`✅ Found actual title: "${actualTitle}" (was "${feed.title}")`);
        
        // Update the feed with the actual title and metadata
        await prisma.feed.update({
          where: { id: feed.id },
          data: {
            title: actualTitle,
            artist: artist,
            description: description,
            image: image,
            lastFetched: new Date()
          }
        });
        
        fixed++;
        console.log(`✅ Updated feed ${feed.id}: "${actualTitle}"`);
        
        // Small delay to be nice to the server
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error processing ${feed.title}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`✅ Fixed: ${fixed} feeds`);
    console.log(`❌ Errors: ${errors} feeds`);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixWavlakeTitles();