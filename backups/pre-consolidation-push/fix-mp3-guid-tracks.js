const fs = require('fs');

async function fixMp3GuidTracks() {
  console.log('🎵 Fixing tracks with MP3 URLs as GUIDs');
  console.log('=' .repeat(50));
  
  // Load current data
  const hghSongs = JSON.parse(fs.readFileSync('./data/hgh-resolved-songs.json', 'utf8'));
  
  // Find tracks with MP3 URLs as item GUIDs that aren't resolved
  const mp3GuidTracks = hghSongs.filter(track => 
    track.itemGuid && 
    track.itemGuid.includes('.mp3') &&
    (track.title.startsWith('Track ') || track.title === 'Unknown Feed')
  );
  
  console.log(`📊 Found ${mp3GuidTracks.length} tracks with MP3 URLs as GUIDs:`);
  mp3GuidTracks.forEach(track => {
    console.log(`   ${track.title} - ${track.itemGuid}`);
  });
  
  if (mp3GuidTracks.length === 0) {
    console.log('✅ No MP3 GUID tracks need fixing');
    return;
  }
  
  let fixedCount = 0;
  const updatedSongs = [...hghSongs];
  
  // Load existing URL maps
  let audioUrlMap = {};
  let artworkUrlMap = {};
  
  try {
    const audioModule = fs.readFileSync('./data/hgh-audio-urls.ts', 'utf8');
    const audioMatch = audioModule.match(/export const HGH_AUDIO_URL_MAP[^{]*{([^}]*)}/s);
    if (audioMatch) {
      const entries = audioMatch[1].match(/"([^"]+)":\s*"([^"]+)"/g);
      if (entries) {
        entries.forEach(entry => {
          const [, title, url] = entry.match(/"([^"]+)":\s*"([^"]+)"/);
          audioUrlMap[title] = url;
        });
      }
    }
    
    const artworkModule = fs.readFileSync('./data/hgh-artwork-urls.ts', 'utf8');
    const artworkMatch = artworkModule.match(/export const HGH_ARTWORK_URL_MAP[^{]*{([^}]*)}/s);
    if (artworkMatch) {
      const entries = artworkMatch[1].match(/"([^"]+)":\s*"([^"]+)"/g);
      if (entries) {
        entries.forEach(entry => {
          const [, title, url] = entry.match(/"([^"]+)":\s*"([^"]+)"/);
          artworkUrlMap[title] = url;
        });
      }
    }
  } catch (error) {
    console.log('Starting with empty URL maps');
  }
  
  for (const track of mp3GuidTracks) {
    console.log(`\n🎯 Processing: ${track.title}`);
    console.log(`   MP3 URL: ${track.itemGuid}`);
    
    const globalIndex = updatedSongs.findIndex(s => 
      s.feedGuid === track.feedGuid && 
      s.itemGuid === track.itemGuid &&
      s.title === track.title
    );
    
    if (globalIndex === -1) continue;
    
    // Extract title from MP3 filename
    const urlParts = track.itemGuid.split('/');
    const filename = urlParts[urlParts.length - 1];
    
    // Parse filename to extract track info
    let extractedTitle = filename
      .replace(/\.mp3$/i, '')
      .replace(/^\d+[\.\-_]\s*/, '') // Remove track numbers
      .replace(/_24Bit_Aria_Master_MTC$/, '') // Remove technical suffixes
      .replace(/[\-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Clean up common patterns
    extractedTitle = extractedTitle
      .replace(/\.$/, '') // Remove trailing period
      .replace(/^\./, '') // Remove leading period
      .trim();
    
    if (extractedTitle && extractedTitle.length > 1) {
      // Try to determine artist from URL or use default
      let artist = 'Unknown Artist';
      
      if (track.itemGuid.includes('falsefinish.club')) {
        artist = 'False Finish';
      } else if (track.itemGuid.includes('bobcatindex')) {
        artist = 'Bobcat';
      }
      
      // Update the track
      updatedSongs[globalIndex].title = extractedTitle;
      updatedSongs[globalIndex].artist = artist;
      updatedSongs[globalIndex].feedTitle = artist;
      
      // Add the MP3 URL directly to audio URLs since the GUID IS the audio URL
      audioUrlMap[extractedTitle] = track.itemGuid;
      
      console.log(`   ✅ FIXED: "${track.title}" → "${extractedTitle}"`);
      console.log(`   🎤 Artist: ${artist}`);
      console.log(`   🎧 Audio URL: ${track.itemGuid}`);
      
      fixedCount++;
      
      // Try to fetch artwork from the same domain
      try {
        const urlBase = track.itemGuid.substring(0, track.itemGuid.lastIndexOf('/'));
        const possibleArtworkUrls = [
          `${urlBase}/cover.jpg`,
          `${urlBase}/artwork.jpg`,
          `${urlBase}/album.jpg`,
          track.itemGuid.replace('.mp3', '.jpg'),
          track.itemGuid.replace('.mp3', '.png')
        ];
        
        for (const artUrl of possibleArtworkUrls) {
          try {
            const artResponse = await fetch(artUrl, { method: 'HEAD' });
            if (artResponse.ok) {
              artworkUrlMap[extractedTitle] = artUrl;
              console.log(`   🖼️ Found artwork: ${artUrl}`);
              break;
            }
          } catch (e) {
            // Continue to next artwork URL
          }
        }
      } catch (error) {
        // No artwork found, that's okay
      }
    } else {
      console.log(`   ❌ Could not extract meaningful title from filename`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Save the updated data
  if (fixedCount > 0) {
    console.log('\n💾 Saving updated data...');
    fs.writeFileSync('./data/hgh-resolved-songs.json', JSON.stringify(updatedSongs, null, 2));
    
    // Update audio URLs
    const audioContent = `import { HGHAudioUrlMap } from '@/types/hgh-types';

// Audio URLs for HGH tracks - Real resolved URLs from Direct RSS + Podcast Index API + MP3 GUID Resolution
export const HGH_AUDIO_URL_MAP: HGHAudioUrlMap = {
${Object.entries(audioUrlMap).map(([title, url]) => 
  `  "${title}": "${url}"`
).join(',\n')}
};
`;
    
    fs.writeFileSync('./data/hgh-audio-urls.ts', audioContent);
    
    // Update artwork URLs
    const artworkContent = `import { HGHArtworkUrlMap } from '@/types/hgh-types';

// Artwork URLs for HGH tracks - Real resolved URLs from Direct RSS + Podcast Index API + MP3 GUID Resolution
export const HGH_ARTWORK_URL_MAP: HGHArtworkUrlMap = {
${Object.entries(artworkUrlMap).map(([title, url]) => 
  `  "${title}": "${url}"`
).join(',\n')}
};
`;
    
    fs.writeFileSync('./data/hgh-artwork-urls.ts', artworkContent);
    
    console.log(`\n🎉 MP3 GUID Fix Complete!`);
    console.log(`✅ Fixed ${fixedCount} tracks with MP3 URLs as GUIDs`);
    
    // Show updated stats
    const finalPlaceholders = updatedSongs.filter(t => t.title.startsWith('Track ')).length;
    const finalUnknown = updatedSongs.filter(t => t.title === 'Unknown Feed').length;
    const finalResolved = updatedSongs.length - finalPlaceholders - finalUnknown;
    
    console.log(`📊 New statistics:`);
    console.log(`   Total tracks: ${updatedSongs.length}`);
    console.log(`   Resolved tracks: ${finalResolved}`);
    console.log(`   Remaining placeholders: ${finalPlaceholders}`);
    console.log(`   Unknown/corrupted: ${finalUnknown}`);
    console.log(`   Success rate: ${((finalResolved / updatedSongs.length) * 100).toFixed(1)}%`);
  } else {
    console.log('\n❌ No tracks were fixed');
  }
}

fixMp3GuidTracks().catch(console.error);