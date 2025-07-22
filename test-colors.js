const ColorThief = require('colorthief');
const https = require('https');
const { createCanvas, loadImage } = require('canvas');

async function getImageBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to fetch image: ${response.statusCode}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

async function extractColorsFromUrl(imageUrl) {
  try {
    console.log('Fetching image from:', imageUrl);
    const imageBuffer = await getImageBuffer(imageUrl);
    
    // Load image using canvas
    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Use ColorThief to get palette
    const palette = ColorThief.getPalette(imageData.data, 3);
    
    // Convert RGB arrays to hex strings
    const colors = palette.map(rgb => {
      const [r, g, b] = rgb;
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    });

    return {
      primary: colors[0],
      secondary: colors[1],
      tertiary: colors[2]
    };
  } catch (error) {
    console.error('Error extracting colors:', error);
    return null;
  }
}

// Test with the Bloodshot Lies album
const albumArtUrl = 'https://www.doerfelverse.com/feeds/bloodshot-lies-album.xml';

// First, let's fetch the RSS feed to get the actual cover art URL
https.get(albumArtUrl, (response) => {
  let data = '';
  response.on('data', (chunk) => data += chunk);
  response.on('end', async () => {
    try {
      // Parse the XML to find the cover art URL
      const coverArtMatch = data.match(/<itunes:image[^>]*href="([^"]*)"/);
      if (coverArtMatch) {
        const coverArtUrl = coverArtMatch[1];
        console.log('Found cover art URL:', coverArtUrl);
        
        const colors = await extractColorsFromUrl(coverArtUrl);
        if (colors) {
          console.log('\n🎨 Bloodshot Lies Album Colors:');
          console.log('Primary:', colors.primary);
          console.log('Secondary:', colors.secondary);
          console.log('Tertiary:', colors.tertiary);
        }
      } else {
        console.log('Could not find cover art URL in RSS feed');
      }
    } catch (error) {
      console.error('Error parsing RSS:', error);
    }
  });
}).on('error', (error) => {
  console.error('Error fetching RSS feed:', error);
}); 