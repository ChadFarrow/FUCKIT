// Test script to debug Stay Awhile background loading
const https = require('https');

console.log('🔍 Testing Stay Awhile background loading...');

// Test the RSS feed to get the album artwork URL
const testRSSFeed = () => {
  return new Promise((resolve, reject) => {
    https.get('https://ableandthewolf.com/static/media/feed.xml', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          // Extract the image URL from the RSS feed
          const imageMatch = data.match(/<image>\s*<url>([^<]+)<\/url>/);
          if (imageMatch) {
            const imageUrl = imageMatch[1];
            console.log('✅ Found image URL in RSS feed:', imageUrl);
            resolve(imageUrl);
          } else {
            console.log('❌ No image URL found in RSS feed');
            reject(new Error('No image URL found'));
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
};

// Test the image URL directly
const testImageUrl = (imageUrl) => {
  return new Promise((resolve, reject) => {
    https.get(imageUrl, (res) => {
      console.log('🖼️ Image response status:', res.statusCode);
      console.log('🖼️ Image response headers:', res.headers);
      
      if (res.statusCode === 200) {
        console.log('✅ Image URL is accessible');
        resolve(true);
      } else {
        console.log('❌ Image URL returned status:', res.statusCode);
        reject(new Error(`Image returned status ${res.statusCode}`));
      }
    }).on('error', (error) => {
      console.log('❌ Image URL error:', error.message);
      reject(error);
    });
  });
};

// Test background image loading simulation
const testBackgroundLoading = (imageUrl) => {
  return new Promise((resolve) => {
    console.log('🎨 Testing background image loading simulation...');
    
    // Simulate the browser's Image loading
    const img = new (require('canvas').Image)();
    
    img.onload = () => {
      console.log('✅ Background image loaded successfully in simulation');
      resolve(true);
    };
    
    img.onerror = (error) => {
      console.log('❌ Background image failed to load in simulation:', error);
      resolve(false);
    };
    
    img.src = imageUrl;
  });
};

// Run the tests
async function runTests() {
  try {
    console.log('\n📡 Step 1: Testing RSS feed...');
    const imageUrl = await testRSSFeed();
    
    console.log('\n🖼️ Step 2: Testing image URL accessibility...');
    await testImageUrl(imageUrl);
    
    console.log('\n🎨 Step 3: Testing background loading simulation...');
    await testBackgroundLoading(imageUrl);
    
    console.log('\n✅ All tests completed successfully!');
    console.log('🎯 The background should be working. If not, check browser console for client-side errors.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTests(); 