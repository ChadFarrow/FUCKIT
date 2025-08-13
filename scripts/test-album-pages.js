#!/usr/bin/env node

const { execSync } = require('child_process');

// Test a sample of albums to see if their pages work
const testAlbums = [
  { title: 'Music From The Doerfel-Verse', expectedSlug: 'music-from-the-doerfel-verse' },
  { title: 'Bloodshot Lies - The Album', expectedSlug: 'bloodshot-lies' },
  { title: 'Into The Doerfel-Verse', expectedSlug: 'into-the-doerfel-verse' },
  { title: 'Stay Awhile', expectedSlug: 'stay-awhile' },
  { title: '18 Sundays', expectedSlug: '18-sundays' },
  { title: 'Alandace', expectedSlug: 'alandace' },
  { title: 'Autumn', expectedSlug: 'autumn' }
];

async function testAlbumPage(album) {
  try {
    console.log(`🔍 Testing: "${album.title}"`);
    console.log(`   Expected slug: ${album.expectedSlug}`);
    
    // Test the album page
    const url = `http://localhost:3000/album/${album.expectedSlug}`;
    const response = execSync(`curl -s "${url}"`, { encoding: 'utf8' });
    
    if (response.includes('Page Not Found')) {
      console.log(`   ❌ Page Not Found`);
      return false;
    } else if (response.includes('Loading Album')) {
      console.log(`   ✅ Loading Album (working)`);
      return true;
    } else if (response.includes('Album Detail')) {
      console.log(`   ✅ Album Detail (working)`);
      return true;
    } else {
      console.log(`   ⚠️  Unknown response`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🎵 Testing Album Pages\n');
  
  let workingCount = 0;
  let totalCount = testAlbums.length;
  
  for (const album of testAlbums) {
    const isWorking = await testAlbumPage(album);
    if (isWorking) workingCount++;
    console.log(''); // Empty line for readability
  }
  
  console.log(`📊 Summary:`);
  console.log(`   ✅ Working: ${workingCount}/${totalCount}`);
  console.log(`   ❌ Not Working: ${totalCount - workingCount}/${totalCount}`);
  console.log(`   📈 Success Rate: ${Math.round((workingCount / totalCount) * 100)}%`);
}

main().catch(console.error);
