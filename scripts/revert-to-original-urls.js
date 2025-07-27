#!/usr/bin/env node

/**
 * Revert CDN URLs to Original Source URLs
 * 
 * Since Bunny CDN has been removed, revert all CDN URLs back to original source URLs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function revertToOriginalUrls() {
  console.log('🔄 Reverting CDN URLs to original source URLs...\n');
  
  try {
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    const feedsContent = await fs.readFile(feedsPath, 'utf8');
    
    console.log('📊 Current CDN URLs found:');
    const cdnUrls = feedsContent.match(/https:\/\/[^"]*\.b-cdn\.net[^"]+/g) || [];
    console.log(`   - ${cdnUrls.length} URLs using CDN`);
    
    if (cdnUrls.length === 0) {
      console.log('✅ No CDN URLs found - already using original URLs!');
      return;
    }
    
    // Create backup
    const backupPath = path.join(__dirname, '..', 'data', `parsed-feeds-backup-${Date.now()}.json`);
    await fs.writeFile(backupPath, feedsContent);
    console.log(`💾 Backup created: ${path.basename(backupPath)}`);
    
    let fixedContent = feedsContent;
    
    // Replace CDN URLs with original source URLs
    // Map common patterns back to original sources
    
    // Replace CDN artwork URLs with original doerfelverse.com URLs
    fixedContent = fixedContent.replace(
      /https:\/\/[^"]*\.b-cdn\.net\/[^"]*\/artwork\/[^"]+/g,
      (match) => {
        // Extract the original filename from the encoded URL
        const filenameMatch = match.match(/artwork-([^-]+)-([^.]+)\.([^.]+)$/);
        if (filenameMatch) {
          const albumName = filenameMatch[1];
          const encodedUrl = filenameMatch[2];
          const extension = filenameMatch[3];
          
          // Decode the base64 URL
          try {
            const decodedUrl = Buffer.from(encodedUrl, 'base64').toString('utf8');
            // Extract just the filename from the decoded URL
            const originalFilename = decodedUrl.split('/').pop();
            return `https://www.doerfelverse.com/art/${originalFilename}`;
          } catch (error) {
            // If decoding fails, use a fallback
            return `https://www.doerfelverse.com/art/${albumName}.${extension}`;
          }
        }
        return match; // Keep original if no pattern match
      }
    );
    
    // Replace any remaining CDN URLs with original sources
    fixedContent = fixedContent.replace(
      /https:\/\/[^"]*\.b-cdn\.net\/albums\/([^"]+)/g,
      'https://www.doerfelverse.com/art/$1'
    );
    
    // Replace any remaining CDN URLs with original sources
    fixedContent = fixedContent.replace(
      /https:\/\/[^"]*\.b-cdn\.net\/artwork\/([^"]+)/g,
      'https://www.doerfelverse.com/art/$1'
    );
    
    // Write the fixed content
    await fs.writeFile(feedsPath, fixedContent);
    
    // Verify the fix
    const remainingCdnUrls = fixedContent.match(/https:\/\/[^"]*\.b-cdn\.net[^"]+/g) || [];
    const originalUrls = fixedContent.match(/https:\/\/www\.doerfelverse\.com\/art\/[^"]+/g) || [];
    
    console.log(`✅ Reverted ${cdnUrls.length - remainingCdnUrls.length} URLs to original sources`);
    console.log(`📊 Original URLs now: ${originalUrls.length}`);
    console.log(`⚠️  Remaining CDN URLs: ${remainingCdnUrls.length}`);
    
    if (remainingCdnUrls.length > 0) {
      console.log('\n⚠️  Some CDN URLs could not be automatically reverted:');
      remainingCdnUrls.slice(0, 5).forEach(url => {
        console.log(`   - ${url}`);
      });
      if (remainingCdnUrls.length > 5) {
        console.log(`   ... and ${remainingCdnUrls.length - 5} more`);
      }
    }
    
    // Show some examples of fixed URLs
    console.log('\n📋 Example fixed URLs:');
    originalUrls.slice(0, 5).forEach(url => {
      console.log(`   - ${url}`);
    });
    
    console.log('\n🎉 CDN URL reversion completed!');
    console.log('   Your images should now load from original sources.');
    
  } catch (error) {
    console.error('❌ Error reverting CDN URLs:', error.message);
  }
}

revertToOriginalUrls();