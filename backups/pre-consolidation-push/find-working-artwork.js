#!/usr/bin/env node

// List of potential artwork URLs to test
const potentialArtwork = {
  // HeyCitizen tracks
  "Porkchops Fried": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/PorkchopsFried.jpg",
  "Not To Worry": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/NotToWorry.jpg", 
  "The Platform (lofi beats mix)": "https://files.heycitizen.xyz/Songs/Albums/Lofi-Experience/lofi-platform.jpg",
  "The Platform": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/ThePlatform.jpg",
  "Pay The Bills": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/PayTheBills.jpg",
  "It's Christmastime Again! (lofi beats mix)": "https://files.heycitizen.xyz/Songs/Albums/Lofi-Experience/lofi-christmastimeagain.jpg",
  
  // Jdog tracks
  "Once Had A Girl": "https://www.thisisjdog.com/media/once-had-a-girl.jpg",
  "Ring That Bell": "https://www.thisisjdog.com/media/ring-that-bell.jpg",
  
  // Direct doerfelverse tracks that might have matching artwork
  "Animosity": "https://www.doerfelverse.com/art/animosity.jpg",
  "You": "https://www.doerfelverse.com/art/you.jpg", 
  "Safe": "https://www.doerfelverse.com/art/safe.jpg",
  "SWEATS": "https://www.doerfelverse.com/art/sweats.jpg",
  "Pour Over": "https://www.doerfelverse.com/art/pour-over.jpg",
  "Worthy Lofi": "https://www.doerfelverse.com/art/worthy-lofi.jpg",
  "Feeling Bout You": "https://www.doerfelverse.com/art/feeling-bout-you.jpg",
  "Breakaway (demo)": "https://www.doerfelverse.com/art/breakaway.jpg",
  "Thought It Was Real": "https://www.doerfelverse.com/art/thought-it-was-real.jpg", 
  "Morning Love": "https://www.doerfelverse.com/art/morning-love.jpg",
  "Phatty The Grasshopper": "https://www.doerfelverse.com/art/phatty.jpg",
  
  // Try alternative extensions or paths
  "Secrets": "https://www.doerfelverse.com/artists/jordandedo/secrets.png",
  "Playing God": "https://www.doerfelverse.com/artists/opus/opus.jpg",
  "Sensitive Guy": "https://www.doerfelverse.com/art/sensitiveguy.jpg",
  "Big Sciota": "https://www.doerfelverse.com/art/generationgap.png"
};

async function testArtworkUrl(url) {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      headers: {
        'User-Agent': 'FUCKIT-Artwork-Checker/1.0'
      }
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function findWorkingArtwork() {
  console.log('🎨 Testing artwork URLs...\n');
  const working = {};
  const failed = [];
  
  for (const [title, url] of Object.entries(potentialArtwork)) {
    console.log(`Testing: ${title}`);
    const works = await testArtworkUrl(url);
    
    if (works) {
      console.log(`  ✅ ${url}`);
      working[title] = url;
    } else {
      console.log(`  ❌ ${url}`);
      failed.push({ title, url });
    }
    
    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('\n📊 Results:');
  console.log(`✅ Working: ${Object.keys(working).length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  console.log('\n📝 Working artwork URLs:\n');
  for (const [title, url] of Object.entries(working)) {
    console.log(`  "${title}": "${url}",`);
  }
  
  return working;
}

findWorkingArtwork().catch(console.error);