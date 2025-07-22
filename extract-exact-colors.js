const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function extractExactColors() {
  try {
    console.log('🎨 Extracting exact colors from Bloodshot Lies album...\n');
    
    // Load the downloaded image
    const image = await loadImage('bloodshot-lies-cover.png');
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Sample pixels to find dominant colors
    const colorCounts = {};
    const sampleStep = 10; // Sample every 10th pixel for performance
    
    for (let i = 0; i < data.length; i += sampleStep * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Skip transparent pixels
      if (data[i + 3] < 128) continue;
      
      // Round colors to reduce noise
      const roundedR = Math.round(r / 10) * 10;
      const roundedG = Math.round(g / 10) * 10;
      const roundedB = Math.round(b / 10) * 10;
      
      const colorKey = `${roundedR},${roundedG},${roundedB}`;
      colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
    }
    
    // Sort colors by frequency
    const sortedColors = Object.entries(colorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10); // Get top 10 colors
    
    console.log('🎨 Top 10 dominant colors in Bloodshot Lies album:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    sortedColors.forEach(([colorKey, count], index) => {
      const [r, g, b] = colorKey.split(',').map(Number);
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      const percentage = ((count / sortedColors[0][1]) * 100).toFixed(1);
      
      console.log(`${index + 1}. RGB(${r}, ${g}, ${b}) = ${hex} (${percentage}%)`);
    });
    
    // Extract the 3 most dominant colors for the app
    const top3 = sortedColors.slice(0, 3);
    const dominantColors = {
      primary: `#${top3[0][0].split(',').map(n => parseInt(n).toString(16).padStart(2, '0')).join('')}`,
      secondary: `#${top3[1][0].split(',').map(n => parseInt(n).toString(16).padStart(2, '0')).join('')}`,
      tertiary: `#${top3[2][0].split(',').map(n => parseInt(n).toString(16).padStart(2, '0')).join('')}`
    };
    
    console.log('\n🎯 App Color Theme (Top 3):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Primary:   ${dominantColors.primary}`);
    console.log(`Secondary: ${dominantColors.secondary}`);
    console.log(`Tertiary:  ${dominantColors.tertiary}`);
    
    console.log('\n💡 These colors will be used throughout your app for:');
    console.log('   • Page background gradients');
    console.log('   • Header and footer styling');
    console.log('   • Button colors and hover effects');
    console.log('   • Progress bars and interactive elements');
    
  } catch (error) {
    console.error('Error extracting colors:', error.message);
  }
}

extractExactColors(); 