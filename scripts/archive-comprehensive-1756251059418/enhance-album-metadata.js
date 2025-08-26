#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Enhanced metadata for albums based on the artist/track information
const ALBUM_ENHANCEMENTS = {
  "The Heycitizen Experience": {
    artist: "HeyCitizen",
    description: "A musical journey featuring experimental beats, lo-fi hip-hop, and ambient soundscapes. This collection showcases HeyCitizen's diverse production style across multiple genres.",
    genre: "Electronic/Hip-Hop",
    year: "2024"
  },
  "Ben Doerfel": {
    artist: "Ben Doerfel", 
    description: "Singer-songwriter and musician from the Doerfel family, creating heartfelt acoustic and folk-inspired music with personal storytelling.",
    genre: "Folk/Acoustic",
    year: "2024"
  },
  "DFB Volume 2": {
    artist: "Doerfel Family Bluegrass",
    description: "The second volume from the Doerfel Family Bluegrass band, featuring traditional and contemporary bluegrass with family harmonies and skilled musicianship.",
    genre: "Bluegrass/Folk",
    year: "2024"
  },
  "CityBeach": {
    artist: "CityBeach",
    description: "Indie rock band creating atmospheric soundscapes with introspective lyrics, blending modern rock with dreamy, coastal vibes.",
    genre: "Indie Rock",
    year: "2024"
  },
  "Live From the Other Side": {
    artist: "Theo Katzman",
    description: "Live recordings captured in intimate venues across London and Amsterdam, showcasing raw acoustic performances and audience connection.",
    genre: "Live/Acoustic",
    year: "2024"
  },
  "II": {
    artist: "II",
    description: "Minimalist electronic music project exploring ambient textures and melodic progressions with a focus on emotional resonance.",
    genre: "Electronic/Ambient",
    year: "2024"
  },
  "Kurtisdrums": {
    artist: "Kurtis",
    description: "Percussion-focused compositions blending traditional drumming with modern production, creating rhythmic landscapes and beat-driven melodies.",
    genre: "Experimental/Percussion",
    year: "2024"
  },
  "Jimmy V - Music": {
    artist: "Jimmy V",
    description: "Soulful singer-songwriter creating honest, heartfelt music with strong vocal performances and compelling storytelling.",
    genre: "Singer-Songwriter",
    year: "2024"
  },
  "Ring That Bell": {
    artist: "Ring That Bell",
    description: "Folk-rock project combining traditional storytelling with modern instrumentation, creating anthemic songs with memorable hooks.",
    genre: "Folk Rock",
    year: "2024"
  },
  "The Satellite Skirmish": {
    artist: "The Satellite Skirmish",
    description: "Experimental rock band exploring space-themed concepts through atmospheric soundscapes and progressive song structures.",
    genre: "Progressive Rock",
    year: "2024"
  }
};

// Artist name fixes for tracks that have incorrect or missing artist info
const ARTIST_FIXES = {
  "": "Various Artists", // Fix empty artist names
  "The Heycitizen Experience": "HeyCitizen",
  "Ben Doerfel": "Ben Doerfel",
  "Doerfel Family Bluegrass": "Doerfel Family Bluegrass",
  "Breathe EP": "The Greensands",
  "Going Gold Single": "The Greensands"
};

async function enhanceAlbumMetadata() {
  try {
    const parsedFeedsPath = path.join(__dirname, '../data/parsed-feeds.json');
    
    if (!fs.existsSync(parsedFeedsPath)) {
      console.error('❌ parsed-feeds.json not found');
      return;
    }
    
    console.log('🔄 Loading parsed feeds data...');
    const data = JSON.parse(fs.readFileSync(parsedFeedsPath, 'utf8'));
    
    let enhancedCount = 0;
    let artistFixCount = 0;
    
    // Enhance album metadata
    data.feeds.forEach((feed, index) => {
      if (feed.parseStatus === 'success' && feed.parsedData?.album) {
        const album = feed.parsedData.album;
        const albumTitle = album.title;
        
        // Apply album enhancements
        if (ALBUM_ENHANCEMENTS[albumTitle]) {
          const enhancement = ALBUM_ENHANCEMENTS[albumTitle];
          
          console.log(`✨ Enhancing album: "${albumTitle}"`);
          
          // Update album metadata
          if (enhancement.artist && album.artist !== enhancement.artist) {
            console.log(`  🎤 Artist: "${album.artist}" → "${enhancement.artist}"`);
            album.artist = enhancement.artist;
          }
          
          if (enhancement.description && album.description !== enhancement.description) {
            console.log(`  📝 Description: Enhanced`);
            album.description = enhancement.description;
          }
          
          if (enhancement.genre) {
            console.log(`  🎵 Genre: ${enhancement.genre}`);
            album.genre = enhancement.genre;
          }
          
          if (enhancement.year) {
            console.log(`  📅 Year: ${enhancement.year}`);
            album.year = enhancement.year;
          }
          
          enhancedCount++;
        }
        
        // Fix artist names in tracks
        if (album.tracks && Array.isArray(album.tracks)) {
          album.tracks.forEach((track, trackIndex) => {
            const originalArtist = track.artist || album.artist;
            
            // Apply artist fixes
            Object.keys(ARTIST_FIXES).forEach(key => {
              if (originalArtist === key || (key === "" && (!originalArtist || originalArtist.trim() === ""))) {
                const newArtist = ARTIST_FIXES[key];
                if (track.artist !== newArtist) {
                  console.log(`  🎤 Track "${track.title}" artist: "${originalArtist}" → "${newArtist}"`);
                  track.artist = newArtist;
                  artistFixCount++;
                }
              }
            });
            
            // Ensure track has artist field
            if (!track.artist) {
              track.artist = album.artist || "Unknown Artist";
            }
            
            // Enhance track descriptions if missing
            if (!track.summary || track.summary === `${track.title} by ${track.artist}`) {
              track.summary = `${track.title} by ${track.artist} from ${albumTitle}`;
            }
          });
        }
      }
    });
    
    // Save enhanced data
    console.log('\n💾 Saving enhanced metadata...');
    fs.writeFileSync(parsedFeedsPath, JSON.stringify(data, null, 2));
    
    console.log(`\n✅ Enhancement complete!`);
    console.log(`📊 Albums enhanced: ${enhancedCount}`);
    console.log(`🎤 Artist names fixed: ${artistFixCount}`);
    
    // Also enhance the music tracks data for consistency
    console.log('\n🔄 Enhancing music tracks data...');
    const musicTracksPath = path.join(__dirname, '../data/music-tracks.json');
    
    if (fs.existsSync(musicTracksPath)) {
      const musicData = JSON.parse(fs.readFileSync(musicTracksPath, 'utf8'));
      let tracksFixed = 0;
      
      musicData.musicTracks.forEach(track => {
        const originalArtist = track.artist;
        
        // Apply artist fixes to music tracks
        Object.keys(ARTIST_FIXES).forEach(key => {
          if (originalArtist === key || (key === "" && (!originalArtist || originalArtist.trim() === ""))) {
            const newArtist = ARTIST_FIXES[key];
            if (track.artist !== newArtist) {
              console.log(`🎤 Music track "${track.title}" artist: "${originalArtist}" → "${newArtist}"`);
              track.artist = newArtist;
              tracksFixed++;
            }
          }
        });
        
        // Update album field if it matches enhanced album
        if (ALBUM_ENHANCEMENTS[track.album]) {
          const enhancement = ALBUM_ENHANCEMENTS[track.album];
          if (enhancement.artist && track.artist !== enhancement.artist) {
            track.artist = enhancement.artist;
          }
        }
      });
      
      // Update metadata
      musicData.metadata = {
        ...musicData.metadata,
        lastUpdated: new Date().toISOString(),
        enhanced: true,
        enhancedAt: new Date().toISOString()
      };
      
      fs.writeFileSync(musicTracksPath, JSON.stringify(musicData, null, 2));
      console.log(`✅ Music tracks enhanced: ${tracksFixed} artist names fixed`);
    }
    
  } catch (error) {
    console.error('❌ Error enhancing album metadata:', error);
  }
}

if (require.main === module) {
  enhanceAlbumMetadata().catch(console.error);
}