#!/usr/bin/env node

/**
 * Update to Optimized Images
 * 
 * Replace large image URLs with optimized versions to prevent loading issues
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map of large images to their optimized versions
const imageReplacements = {
  'https://www.doerfelverse.com/art/disco-swag.png': 'https://re.podtards.com/api/optimized-images/disco-swag.png',
  'https://www.doerfelverse.com/art/first-christmas-art.jpg': 'https://re.podtards.com/api/optimized-images/first-christmas-art.jpg',
  'https://www.doerfelverse.com/art/let-go-art.png': 'https://re.podtards.com/api/optimized-images/let-go-art.png'
};

async function updateToOptimizedImages() {
  console.log('🔄 Updating to optimized image URLs...\n');
  
  try {
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    const feedsContent = await fs.readFile(feedsPath, 'utf8');
    
    console.log('📊 Current large image URLs found:');
    let replacementCount = 0;
    let updatedContent = feedsContent;
    
    for (const [originalUrl, optimizedUrl] of Object.entries(imageReplacements)) {
      const matches = (feedsContent.match(new RegExp(originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []);
      if (matches.length > 0) {
        console.log(`   - ${originalUrl.split('/').pop()}: ${matches.length} occurrences`);
        updatedContent = updatedContent.replace(new RegExp(originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), optimizedUrl);
        replacementCount += matches.length;
      }
    }
    
    if (replacementCount === 0) {
      console.log('✅ No large image URLs found to replace!');
      return;
    }
    
    // Create backup
    const backupPath = path.join(__dirname, '..', 'data', `parsed-feeds-backup-${Date.now()}.json`);
    await fs.writeFile(backupPath, feedsContent);
    console.log(`💾 Backup created: ${path.basename(backupPath)}`);
    
    // Write updated content
    await fs.writeFile(feedsPath, updatedContent);
    
    console.log(`✅ Replaced ${replacementCount} large image URLs with optimized versions`);
    
    // Show examples
    console.log('\n📋 Example replacements:');
    for (const [originalUrl, optimizedUrl] of Object.entries(imageReplacements)) {
      const filename = originalUrl.split('/').pop();
      console.log(`   - ${filename}: ${originalUrl} → ${optimizedUrl}`);
    }
    
    console.log('\n🎉 Image URL update completed!');
    console.log('💡 The optimized images should load much faster and prevent "corrupt or truncated" errors');
    
  } catch (error) {
    console.error('❌ Error updating image URLs:', error.message);
  }
}

updateToOptimizedImages(); 