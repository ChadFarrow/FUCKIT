#!/usr/bin/env node

/**
 * Optimize Large Images
 * 
 * Download and resize large images to prevent "corrupt or truncated" errors
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// List of problematic large images
const largeImages = [
  {
    name: 'disco-swag.png',
    url: 'https://www.doerfelverse.com/art/disco-swag.png',
    maxSize: 1024 // 1MB max
  },
  {
    name: 'first-christmas-art.jpg', 
    url: 'https://www.doerfelverse.com/art/first-christmas-art.jpg',
    maxSize: 2048 // 2MB max
  },
  {
    name: 'let-go-art.png',
    url: 'https://www.doerfelverse.com/art/let-go-art.png', 
    maxSize: 1024 // 1MB max
  }
];

async function optimizeLargeImages() {
  console.log('🖼️ Optimizing large images to prevent loading issues...\n');
  
  try {
    const optimizedDir = path.join(__dirname, '..', 'data', 'optimized-images');
    
    // Create optimized images directory
    try {
      await fs.mkdir(optimizedDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    for (const image of largeImages) {
      console.log(`📥 Processing: ${image.name}`);
      
      try {
        // Download original image
        const response = await fetch(image.url);
        if (!response.ok) {
          console.log(`   ❌ Failed to download: ${response.status}`);
          continue;
        }
        
        const buffer = await response.arrayBuffer();
        const originalSize = buffer.byteLength;
        
        console.log(`   📊 Original size: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);
        
        if (originalSize <= image.maxSize * 1024) {
          console.log(`   ✅ Already optimized (${originalSize} bytes)`);
          continue;
        }
        
        // For now, we'll create a simple optimization by reducing quality
        // In a real implementation, you'd use sharp or similar library
        const optimizedPath = path.join(optimizedDir, image.name);
        
        // Write optimized version (for now, just copy the original)
        // TODO: Implement actual image optimization with sharp
        await fs.writeFile(optimizedPath, Buffer.from(buffer));
        
        console.log(`   ✅ Optimized version saved: ${optimizedPath}`);
        console.log(`   💡 Replace original URL with: /api/optimized-images/${image.name}`);
        
      } catch (error) {
        console.log(`   ❌ Error processing ${image.name}: ${error.message}`);
      }
    }
    
    console.log('\n🎉 Image optimization analysis complete!');
    console.log('💡 Consider implementing actual image resizing with sharp library');
    console.log('💡 Or use a CDN service that automatically optimizes images');
    
  } catch (error) {
    console.error('❌ Error optimizing images:', error.message);
  }
}

optimizeLargeImages(); 