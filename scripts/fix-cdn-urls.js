#!/usr/bin/env node

/**
 * Fix CDN URL Mismatch in parsed-feeds.json
 * 
 * Changes all FUCKIT.b-cdn.net URLs to re-podtards-cdn.b-cdn.net
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixCDNUrls() {
  console.log('🔧 Fixing CDN URL mismatch...\n');
  
  try {
    const feedsPath = path.join(__dirname, '..', 'data', 'parsed-feeds.json');
    const feedsContent = await fs.readFile(feedsPath, 'utf8');
    
    console.log('📊 Current CDN URLs found:');
    const oldUrls = feedsContent.match(/https:\/\/FUCKIT\.b-cdn\.net\/cache\/artwork\/[^"]+/g) || [];
    console.log(`   - ${oldUrls.length} URLs using FUCKIT.b-cdn.net`);
    
    if (oldUrls.length === 0) {
      console.log('✅ No URLs to fix - CDN URLs are already correct!');
      return;
    }
    
    // Create backup
    const backupPath = path.join(__dirname, '..', 'data', `parsed-feeds-backup-${Date.now()}.json`);
    await fs.writeFile(backupPath, feedsContent);
    console.log(`💾 Backup created: ${path.basename(backupPath)}`);
    
    // Fix the URLs
    const fixedContent = feedsContent.replace(
      /https:\/\/FUCKIT\.b-cdn\.net\/cache\/artwork\//g,
      'https://re-podtards-cdn.b-cdn.net/image/'
    );
    
    // Write the fixed content
    await fs.writeFile(feedsPath, fixedContent);
    
    // Verify the fix
    const newUrls = fixedContent.match(/https:\/\/re-podtards-cdn\.b-cdn\.net\/image\/[^"]+/g) || [];
    console.log(`✅ Fixed ${oldUrls.length} URLs to use re-podtards-cdn.b-cdn.net`);
    console.log(`📊 New CDN URLs: ${newUrls.length}`);
    
    // Show some examples
    console.log('\n📋 Example fixed URLs:');
    newUrls.slice(0, 5).forEach(url => {
      console.log(`   - ${url}`);
    });
    
    console.log('\n🎉 CDN URL fix completed!');
    console.log('   Your images should now load correctly.');
    
  } catch (error) {
    console.error('❌ Error fixing CDN URLs:', error.message);
  }
}

fixCDNUrls(); 