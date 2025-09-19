const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

// Create Prisma client with production database URL
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:EGGAhzFPWWcJfJpngnRzSqROgUqxJwxe@roundhouse.proxy.rlwy.net:51528/railway'
    }
  }
});

// Simple XML parser for this specific use case
function parseXML(xmlString) {
  try {
    // Extract title from XML
    const titleMatch = xmlString.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>/);
    const authorMatch = xmlString.match(/<itunes:author[^>]*>(.*?)<\/itunes:author>/) || 
                       xmlString.match(/<author[^>]*><!\[CDATA\[(.*?)\]\]><\/author>/);
    const descMatch = xmlString.match(/<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>/);
    const imageMatch = xmlString.match(/<itunes:image[^>]*href="([^"]*)"/) ||
                      xmlString.match(/<image[^>]*>([^<]*)<\/image>/);
    
    return {
      title: titleMatch ? titleMatch[1].trim() : null,
      author: authorMatch ? authorMatch[1].trim() : null,
      description: descMatch ? descMatch[1].trim() : null,
      image: imageMatch ? imageMatch[1].trim() : null
    };
  } catch (error) {
    return { title: null, author: null, description: null, image: null };
  }
}

async function fixWavlakeTitles() {
  try {
    console.log('🔧 Starting production Wavlake titles fix...');
    
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
      console.log('✅ No generic Wavlake Album titles found');
      return;
    }
    
    // Show what we found
    console.log('\n📋 Generic titles found:');
    genericFeeds.forEach(feed => {
      console.log(`  - ${feed.title} (${feed.id})`);
    });
    
    let fixed = 0;
    let errors = 0;
    
    for (const feed of genericFeeds) {
      try {
        console.log(`\n🔄 Processing ${feed.title} (${feed.originalUrl})`);
        
        // Fetch the RSS feed with timeout
        const response = await axios.get(feed.originalUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Music-Feed-Parser/1.0)'
          }
        });
        
        const parsed = parseXML(response.data);
        
        if (!parsed.title || parsed.title.trim() === '') {
          console.error(`❌ No valid title found in RSS for ${feed.title}`);
          errors++;
          continue;
        }
        
        const actualTitle = parsed.title.trim();
        
        console.log(`✅ Found actual title: "${actualTitle}"`);
        console.log(`   Artist: ${parsed.author || 'N/A'}`);
        
        // Update the feed with the actual title and metadata
        await prisma.feed.update({
          where: { id: feed.id },
          data: {
            title: actualTitle,
            artist: parsed.author || undefined,
            description: parsed.description || undefined,
            image: parsed.image || undefined,
            lastFetched: new Date()
          }
        });
        
        fixed++;
        console.log(`✅ Updated feed ${feed.id}: "${feed.title}" → "${actualTitle}"`);
        
        // Small delay to be nice to the server
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error processing ${feed.title}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`✅ Fixed: ${fixed} feeds`);
    console.log(`❌ Errors: ${errors} feeds`);
    console.log(`📝 Total processed: ${genericFeeds.length} feeds`);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixWavlakeTitles();