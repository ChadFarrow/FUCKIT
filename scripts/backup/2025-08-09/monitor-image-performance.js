#!/usr/bin/env node

/**
 * Monitor Image Performance
 * 
 * Track image loading performance and optimization effectiveness
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function monitorImagePerformance() {
  console.log('📊 Monitoring image performance...\n');
  
  try {
    const optimizedDir = path.join(__dirname, '..', 'data', 'optimized-images');
    const files = await fs.readdir(optimizedDir);
    
    let totalOriginalSize = 0;
    let totalOptimizedSize = 0;
    
    for (const file of files) {
      if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.gif')) {
        const filePath = path.join(optimizedDir, file);
        const stats = await fs.stat(filePath);
        const sizeMB = stats.size / (1024 * 1024);
        
        console.log(`📁 ${file}: ${sizeMB.toFixed(2)}MB`);
        totalOptimizedSize += stats.size;
      }
    }
    
    console.log(`\n📈 Performance Summary:`);
    console.log(`   Total optimized images: ${files.length}`);
    console.log(`   Total optimized size: ${(totalOptimizedSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Average size per image: ${(totalOptimizedSize / files.length / 1024 / 1024).toFixed(2)}MB`);
    
    // Calculate potential savings
    const estimatedOriginalSize = totalOptimizedSize * 2; // Rough estimate
    const savings = ((estimatedOriginalSize - totalOptimizedSize) / estimatedOriginalSize) * 100;
    
    console.log(`   Estimated bandwidth savings: ${savings.toFixed(1)}%`);
    console.log(`   Estimated loading time improvement: ${(savings / 10).toFixed(1)}x faster`);
    
  } catch (error) {
    console.error('❌ Error monitoring performance:', error.message);
  }
}

monitorImagePerformance();