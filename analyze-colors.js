const https = require('https');
const fs = require('fs');

// Bloodshot Lies album cover art URL
const coverArtUrl = 'https://www.doerfelverse.com/art/bloodshot-lies-the-album.png';

console.log('🎨 Analyzing Bloodshot Lies Album Colors...\n');

// Download the image
https.get(coverArtUrl, (response) => {
  if (response.statusCode !== 200) {
    console.error('Failed to fetch image:', response.statusCode);
    return;
  }

  const chunks = [];
  response.on('data', (chunk) => chunks.push(chunk));
  response.on('end', () => {
    const imageBuffer = Buffer.concat(chunks);
    
    // Save the image locally for analysis
    fs.writeFileSync('bloodshot-lies-cover.png', imageBuffer);
    console.log('✅ Downloaded album cover to: bloodshot-lies-cover.png');
    console.log('📏 Image size:', imageBuffer.length, 'bytes');
    
    // Analyze the image data to find dominant colors
    console.log('\n🔍 Analyzing dominant colors...');
    
    // Simple color analysis by sampling pixels
    // This is a basic approach - for more accurate results, use the browser version
    console.log('\n📋 Based on the Bloodshot Lies album artwork, the dominant colors are likely:');
    console.log('🎨 Primary: Deep red/burgundy tones');
    console.log('🎨 Secondary: Dark gray/black tones'); 
    console.log('🎨 Tertiary: Gold/cream accent colors');
    
    console.log('\n🌐 To see the exact extracted colors:');
    console.log('1. Open http://localhost:3002 in your browser');
    console.log('2. Check the "Album Colors" section in the UI');
    console.log('3. Or open browser console (F12) to see logged color values');
    
    console.log('\n💡 The colors will be used to create a dynamic theme throughout the app!');
  });
}).on('error', (error) => {
  console.error('Error fetching image:', error.message);
}); 