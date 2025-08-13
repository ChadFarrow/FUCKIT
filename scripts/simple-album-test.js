#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🎵 Simple Album Page Test\n');

// Test one album at a time
const testAlbum = 'music-from-the-doerfel-verse';
console.log(`Testing: ${testAlbum}`);

try {
  const response = execSync(`curl -s "http://localhost:3000/album/${testAlbum}"`, { encoding: 'utf8' });
  
  if (response.includes('Page Not Found')) {
    console.log('❌ Page Not Found');
  } else if (response.includes('Loading Album')) {
    console.log('✅ Loading Album (working)');
  } else if (response.includes('Album Detail')) {
    console.log('✅ Album Detail (working)');
  } else {
    console.log('⚠️  Unknown response');
    console.log('Response preview:', response.substring(0, 200));
  }
} catch (error) {
  console.log('❌ Error:', error.message);
}
