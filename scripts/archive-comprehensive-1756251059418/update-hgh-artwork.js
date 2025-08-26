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

async function updateHGHArtwork() {
  try {
    console.log('🚀 Starting HGH artwork resolution via Podcast Index API...');
    
    // Load HGH resolved songs
    const hghSongsPath = path.join(__dirname, '..', 'data', 'hgh-resolved-songs.json');
    const hghSongs = JSON.parse(fs.readFileSync(hghSongsPath, 'utf8'));
    
    console.log(`📋 Found ${hghSongs.length} HGH songs to process`);
    
    const updatedArtwork = {};
    const errors = [];
    
    for (let i = 0; i < hghSongs.length; i++) {
      const song = hghSongs[i];
      const progress = `[${i + 1}/${hghSongs.length}]`;
      
      try {
        console.log(`${progress} Processing: "${song.title}" by ${song.artist}`);
        
        // Call our resolve-artwork API
        const url = `http://localhost:3001/api/resolve-artwork?feedGuid=${encodeURIComponent(song.feedGuid)}${song.itemGuid ? '&itemGuid=' + encodeURIComponent(song.itemGuid) : ''}`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success && result.artwork) {
          updatedArtwork[song.title] = result.artwork;
          console.log(`  ✅ Found: ${result.artwork}`);
        } else {
          console.log(`  ❌ No artwork found`);
          errors.push(`${song.title}: ${result.error || 'No artwork'}`);
        }
        
        // Small delay to avoid overwhelming the API
        if (i < hghSongs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        errors.push(`${song.title}: ${error.message}`);
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
    const backupPath = artworkUrlsPath + '.backup-' + Date.now();
    fs.writeFileSync(backupPath, currentContent);
    console.log(`💾 Backed up original to: ${path.basename(backupPath)}`);
    
    // Write updated file
    fs.writeFileSync(artworkUrlsPath, newContent);
    console.log(`✅ Updated ${artworkUrlsPath}`);
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log(`\n🎉 HGH artwork update complete!`);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

updateHGHArtwork();