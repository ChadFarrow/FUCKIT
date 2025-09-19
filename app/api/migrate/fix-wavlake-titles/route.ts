import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import axios from 'axios';

// Simple XML parser for this specific use case
function parseXML(xmlString: string) {
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

export async function POST(request: Request) {
  try {
    console.log('🔧 Starting Wavlake titles migration...');
    
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
      return NextResponse.json({
        success: true,
        message: 'No generic Wavlake Album titles found',
        fixed: 0,
        errors: 0
      });
    }
    
    let fixed = 0;
    let errors = 0;
    const results: any[] = [];
    
    for (const feed of genericFeeds) {
      try {
        console.log(`🔄 Processing ${feed.title} (${feed.originalUrl})`);
        
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
          results.push({
            feedId: feed.id,
            oldTitle: feed.title,
            newTitle: null,
            status: 'error',
            error: 'No valid title found in RSS'
          });
          continue;
        }
        
        const actualTitle = parsed.title.trim();
        
        console.log(`✅ Found actual title: "${actualTitle}" (was "${feed.title}")`);
        
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
        results.push({
          feedId: feed.id,
          oldTitle: feed.title,
          newTitle: actualTitle,
          artist: parsed.author,
          status: 'success'
        });
        
        console.log(`✅ Updated feed ${feed.id}: "${actualTitle}"`);
        
        // Small delay to be nice to the server
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Error processing ${feed.title}:`, (error as Error).message);
        errors++;
        results.push({
          feedId: feed.id,
          oldTitle: feed.title,
          newTitle: null,
          status: 'error',
          error: (error as Error).message
        });
      }
    }
    
    const summary = {
      success: true,
      message: `Wavlake titles migration completed`,
      fixed,
      errors,
      totalProcessed: genericFeeds.length,
      results
    };
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`✅ Fixed: ${fixed} feeds`);
    console.log(`❌ Errors: ${errors} feeds`);
    
    return NextResponse.json(summary);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      message: (error as Error).message
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Wavlake titles migration endpoint',
    instructions: 'Send a POST request to run the migration'
  });
}