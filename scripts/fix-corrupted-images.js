#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const corruptedImages = [
  'disco-swag.png',
  'autumn.gif',
  'let-go-art.png',
  'first-christmas-art.jpg',
  'WIldandfreecover-copy-2.png'
];

const optimizedImagesDir = path.join(__dirname, '../data/optimized-images');

async function createPlaceholderImage(filename, width = 800, height = 800) {
  const outputPath = path.join(optimizedImagesDir, filename);
  
  try {
    // Create a simple placeholder image
    const placeholder = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 100, g: 100, b: 100, alpha: 1 }
      }
    })
    .png()
    .composite([{
      input: Buffer.from(`
        <svg width="${width}" height="${height}">
          <rect width="100%" height="100%" fill="#666"/>
          <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-family="Arial" font-size="24">
            ${filename.replace(/\.[^/.]+$/, '')}
          </text>
        </svg>
      `),
      top: 0,
      left: 0
    }]);

    await placeholder.toFile(outputPath);
    console.log(`✅ Created placeholder for ${filename}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to create placeholder for ${filename}:`, error.message);
    return false;
  }
}

async function fixCorruptedImages() {
  console.log('🔧 Fixing corrupted images...');
  
  for (const filename of corruptedImages) {
    const filePath = path.join(optimizedImagesDir, filename);
    
    if (fs.existsSync(filePath)) {
      try {
        // Try to validate the image
        const image = sharp(filePath);
        await image.metadata();
        console.log(`✅ ${filename} is valid`);
      } catch (error) {
        console.log(`❌ ${filename} is corrupted, creating placeholder...`);
        await createPlaceholderImage(filename);
      }
    } else {
      console.log(`⚠️  ${filename} not found, creating placeholder...`);
      await createPlaceholderImage(filename);
    }
  }
  
  console.log('✅ Image fix complete');
}

// Run the fix
fixCorruptedImages().catch(console.error); 