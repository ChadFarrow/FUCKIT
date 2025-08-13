const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key] = value;
    }
  });
}

async function updateHGHArtworkFast() {
  try {
    console.log('🚀 Starting FAST HGH artwork resolution via Podcast Index API...');
    
    // Load HGH resolved songs
    const hghSongsPath = path.join(__dirname, '..', 'data', 'hgh-resolved-songs.json');
    const hghSongs = JSON.parse(fs.readFileSync(hghSongsPath, 'utf8'));
    
    console.log(`📋 Found ${hghSongs.length} HGH songs to process`);
    
    const updatedArtwork = {};
    const errors = [];
    
    // Process in batches of 10 for speed
    const BATCH_SIZE = 10;
    const batches = [];
    
    for (let i = 0; i < hghSongs.length; i += BATCH_SIZE) {
      batches.push(hghSongs.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`🔄 Processing ${batches.length} batches of ${BATCH_SIZE} tracks each...`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n📦 Batch ${batchIndex + 1}/${batches.length} - Processing ${batch.length} tracks...`);
      
      // Process all tracks in this batch concurrently
      const batchPromises = batch.map(async (song, songIndex) => {
        const globalIndex = batchIndex * BATCH_SIZE + songIndex + 1;
        const progress = `[${globalIndex}/${hghSongs.length}]`;
        
        try {
          console.log(`${progress} Processing: "${song.title}" by ${song.artist}`);
          
          // Call our resolve-artwork API
          const url = `http://localhost:3001/api/resolve-artwork?feedGuid=${encodeURIComponent(song.feedGuid)}${song.itemGuid ? '&itemGuid=' + encodeURIComponent(song.itemGuid) : ''}`;
          
          const response = await fetch(url);
          const result = await response.json();
          
          if (result.success && result.artwork) {
            updatedArtwork[song.title] = result.artwork;
            console.log(`  ✅ Found: ${result.artwork}`);
            return { success: true, title: song.title, artwork: result.artwork };
          } else {
            console.log(`  ❌ No artwork found`);
            errors.push(`${song.title}: ${result.error || 'No artwork'}`);
            return { success: false, title: song.title, error: result.error || 'No artwork' };
          }
          
        } catch (error) {
          console.log(`  ❌ Error: ${error.message}`);
          errors.push(`${song.title}: ${error.message}`);
          return { success: false, title: song.title, error: error.message };
        }
      });
      
      // Wait for all tracks in this batch to complete
      await Promise.all(batchPromises);
      
      // Small delay between batches to avoid overwhelming the API
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log(`\n📊 Resolution complete:`);
    console.log(`  ✅ Successfully resolved: ${Object.keys(updatedArtwork).length}`);
    console.log(`  ❌ Failed to resolve: ${errors.length}`);
    
    // Load current artwork mapping
    const artworkUrlsPath = path.join(__dirname, '..', 'data', 'hgh-artwork-urls.ts');
    let currentContent = fs.readFileSync(artworkUrlsPath, 'utf8');
    
    // Extract existing mappings
    const mappingMatch = currentContent.match(/export const HGH_ARTWORK_URL_MAP[^=]*=\s*\{([^}]+)\}/s);
    if (!mappingMatch) {
      throw new Error('Could not parse existing HGH_ARTWORK_URL_MAP');
    }
    
    // Merge with new mappings
    console.log(`\n🔄 Updating ${Object.keys(updatedArtwork).length} artwork URLs...`);
    
    // Generate updated mapping object
    const allMappings = {};
    
    // Parse existing mappings (simplified - you might want to improve this parser)
    const existingMappings = mappingMatch[1];
    const lines = existingMappings.split('\n').filter(line => line.trim() && line.includes(':'));
    
    lines.forEach(line => {
      const match = line.match(/["']([^"']+)["']\s*:\s*["']([^"']+)["']/);
      if (match) {
        allMappings[match[1]] = match[2];
      }
    });
    
    // Add new mappings
    Object.assign(allMappings, updatedArtwork);
    
    console.log(`📋 Total mappings: ${Object.keys(allMappings).length}`);
    
    // Generate new file content
    const newMappingContent = Object.entries(allMappings)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, url]) => `  "${title}": "${url}"`)
      .join(',\n');
    
    const newContent = currentContent.replace(
      /export const HGH_ARTWORK_URL_MAP[^=]*=\s*\{[^}]+\}/s,
      `export const HGH_ARTWORK_URL_MAP: HGHArtworkUrlMap = {\n${newMappingContent}\n}`
    );
    
    // Backup original file
    const backupPath = artworkUrlsPath + '.backup-fast-' + Date.now();
    fs.writeFileSync(backupPath, currentContent);
    console.log(`💾 Backed up original to: ${path.basename(backupPath)}`);
    
    // Write updated file
    fs.writeFileSync(artworkUrlsPath, newContent);
    console.log(`✅ Updated ${artworkUrlsPath}`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log(`\n🎉 FAST HGH artwork update complete!`);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

updateHGHArtworkFast();