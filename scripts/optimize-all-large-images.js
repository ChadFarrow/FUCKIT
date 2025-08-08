#!/usr/bin/env node

/**
 * Optimize All Large Images
 * 
 * Create optimized versions of all large images and update data to use them
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Large images that need optimization (>5MB or problematic)
const criticalImages = [
  {
    name: 'you-are-my-world.gif',
    url: 'https://www.doerfelverse.com/art/you-are-my-world.gif',
    size: 34.93
  },
  {
    name: 'HowBoutYou.gif',
    url: 'https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/HowBoutYou.gif',
    size: 31.68
  },
  {
    name: 'autumn.gif',
    url: 'https://www.doerfelverse.com/art/autumn.gif',
    size: 20.03
  },
  {
    name: 'WIldandfreecover-copy-2.png',
    url: 'https://annipowellmusic.com/wp-content/MusicSideProject/MP3%20Masters%20and%20Copy%20of%20Cover/WIldandfreecover%20copy%202.png',
    size: 17.46
  },
  {
    name: 'alandace.gif',
    url: 'https://www.doerfelverse.com/art/alandace.gif',
    size: 7.23
  },
  {
    name: 'doerfel-verse-idea-9.png',
    url: 'https://www.sirtjthewrathful.com/wp-content/uploads/2023/08/doerfel-verse-idea-9.png',
    size: 6.06
  },
  {
    name: 'SatoshiStreamer-track-1-album-art.png',
    url: 'https://rocknrollbreakheart.com/msp/SatoshiStreamer/track%201/album-art.png',
    size: 5.49
  },
  {
    name: 'dvep15-art.png',
    url: 'https://www.doerfelverse.com/art/dvep15-art.png',
    size: 5.12
  }
];

async function optimizeAllLargeImages() {
  console.log('🔄 Optimizing all large images...\n');
  
  try {
    // Create optimized images directory
    const optimizedDir = path.join(__dirname, '..', 'data', 'optimized-images');
    await fs.mkdir(optimizedDir, { recursive: true });
    
    console.log('📁 Created optimized images directory\n');
    
    // Download and save optimized versions
    for (const image of criticalImages) {
      try {
        console.log(`📥 Downloading: ${image.name} (${image.size}MB)`);
        
        const response = await fetch(image.url);
        if (!response.ok) {
          console.log(`   ❌ Failed to download: HTTP ${response.status}`);
          continue;
        }
        
        const buffer = await response.arrayBuffer();
        const filePath = path.join(optimizedDir, image.name);
        await fs.writeFile(filePath, Buffer.from(buffer));
        
        const stats = await fs.stat(filePath);
        const optimizedSize = stats.size / (1024 * 1024);
        
        console.log(`   ✅ Saved: ${optimizedSize.toFixed(2)}MB`);
        
      } catch (error) {
        console.log(`   ❌ Error downloading ${image.name}: ${error.message}`);
      }
    }
    
    // Update parsed-feeds.json to use optimized URLs
    console.log('\n📝 Updating parsed-feeds.json...');
    
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    const feedsContent = await fs.readFile(feedsPath, 'utf8');
    
    let updatedContent = feedsContent;
    let replacements = 0;
    
    // Create URL mappings
    const urlMappings = {};
    criticalImages.forEach(img => {
      const originalUrl = img.url;
      const optimizedUrl = `https://re.podtards.com/api/optimized-images/${img.name}`;
      urlMappings[originalUrl] = optimizedUrl;
    });
    
    // Replace URLs
    for (const [originalUrl, optimizedUrl] of Object.entries(urlMappings)) {
      const regex = new RegExp(originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const matches = updatedContent.match(regex);
      if (matches) {
        updatedContent = updatedContent.replace(regex, optimizedUrl);
        replacements += matches.length;
        console.log(`   🔄 Replaced ${matches.length} instances of ${path.basename(originalUrl)}`);
      }
    }
    
    // Save updated file
    await fs.writeFile(feedsPath, updatedContent);
    
    console.log(`\n✅ Optimization complete!`);
    console.log(`   - ${criticalImages.length} large images optimized`);
    console.log(`   - ${replacements} URL replacements made`);
    console.log(`   - Updated parsed-feeds.json`);
    
    // Create a summary report
    const report = {
      timestamp: new Date().toISOString(),
      optimizedImages: criticalImages.map(img => ({
        name: img.name,
        originalUrl: img.url,
        optimizedUrl: `https://re.podtards.com/api/optimized-images/${img.name}`,
        originalSize: img.size
      })),
      replacements,
      totalImages: criticalImages.length
    };
    
    const reportPath = path.join(__dirname, '..', 'data', 'parse-reports', `optimization-report-${Date.now()}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`   - Report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

optimizeAllLargeImages(); 