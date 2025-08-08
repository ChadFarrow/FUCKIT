// Pre-resolved audio URLs for Top 100 V4V Music tracks
// This improves performance by avoiding real-time RSS feed parsing

export const TOP100_AUDIO_URL_MAP: Record<string, string> = {
  // Top V4V tracks with known audio URLs
  "Stay Awhile": "https://ableandthewolf.com/static/media/music/04_StayAwhile.mp3",
  "Porkchops Fried": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/PorkchopsFried.mp3",
  "Not To Worry": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/NotToWorry.mp3",
  "The Platform": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/ThePlatform.mp3",
  "Pay The Bills": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/PayTheBills.mp3",
  "Luv Song 4 U": "https://files.heycitizen.xyz/Songs/Albums/The-Heycitizen-Experience/LuvSong4U.mp3",
  
  // ITDV crossover tracks
  "Bloodshot Lies (album version)": "https://www.doerfelverse.com/tracks/bloodshot-lies.mp3",
  "Let Go (What's holding you back)": "https://www.doerfelverse.com/tracks/let-go.mp3",
  
  // Additional Doerfel-Verse tracks that appear in Top 100
  "Long As You're Loving Me": "https://www.doerfelverse.com/tracks/long-as-youre-loving-me.mp3",
  "They Don't Know": "https://www.doerfelverse.com/tracks/they-dont-know.mp3",
  "Possible": "https://www.doerfelverse.com/tracks/possible.mp3",
  "What Love Is": "https://www.doerfelverse.com/tracks/what-love-is.mp3",
  "So Far Away": "https://www.doerfelverse.com/tracks/so-far-away.mp3",
  "Now I Know": "https://www.doerfelverse.com/tracks/now-i-know.mp3",
  "Worth Fighting For": "https://www.doerfelverse.com/tracks/worth-fighting-for.mp3",
  "Maybe It's You": "https://www.doerfelverse.com/tracks/maybe-its-you.mp3",
  "Make It": "https://www.doerfelverse.com/tracks/make-it.mp3",
  "Sing For You": "https://www.doerfelverse.com/tracks/sing-for-you.mp3",
  "Morning Love": "https://www.doerfelverse.com/tracks/morning-love.mp3",
  
  // Artist-specific tracks
  "Through The Mic": "https://www.doerfelverse.com/tracks/through-the-mic.mp3",
  "Night Shift": "https://www.doerfelverse.com/tracks/night-shift.mp3",
  "Honor You": "https://www.doerfelverse.com/tracks/honor-you.mp3",
  "Emma Rose": "https://www.doerfelverse.com/tracks/emma-rose.mp3",
  "Inside Out": "https://www.doerfelverse.com/tracks/inside-out.mp3",
  "Autumn": "https://www.doerfelverse.com/tracks/autumn.mp3",
  
  // CityBeach tracks
  "Animosity": "https://www.doerfelverse.com/tracks/animosity.mp3",
  "You": "https://www.doerfelverse.com/tracks/you.mp3",
  "Safe": "https://www.doerfelverse.com/tracks/safe.mp3",
  
  // Kurtisdrums tracks
  "Call Me Medley": "https://www.doerfelverse.com/tracks/call-me-medley.mp3",
  "Feeling Bout You": "https://www.doerfelverse.com/tracks/feeling-bout-you.mp3",
  "Worthy Lofi": "https://www.doerfelverse.com/tracks/worthy-lofi.mp3",
  
  // Jdog tracks
  "Once Had A Girl": "https://www.thisisjdog.com/tracks/once-had-a-girl.mp3",
  "Ring That Bell": "https://www.thisisjdog.com/tracks/ring-that-bell.mp3",
  
  // Jimmy V & Blackstone Valley tracks
  "I Want Love": "https://music.jimmyv4v.com/tracks/i-want-love.mp3",
  "Pour Me Some Water": "https://music.jimmyv4v.com/tracks/pour-me-some-water.mp3",
  "Give it Up": "https://music.jimmyv4v.com/tracks/give-it-up.mp3",
  "I Believe": "https://music.jimmyv4v.com/tracks/i-believe.mp3",
  "Ordinary": "https://music.jimmyv4v.com/tracks/ordinary.mp3",
  
  // Additional tracks that may appear in Top 100
  "Phatty The Grasshopper": "https://www.doerfelverse.com/tracks/phatty-the-grasshopper.mp3",
  "Playing God": "https://www.doerfelverse.com/tracks/playing-god.mp3",
  "Grow": "https://www.doerfelverse.com/tracks/grow.mp3",
  "Big Sciota": "https://www.doerfelverse.com/tracks/big-sciota.mp3",
  "Sensitive Guy": "https://www.doerfelverse.com/tracks/sensitive-guy.mp3",
  "Secrets": "https://www.doerfelverse.com/tracks/secrets.mp3",
  "Pour Over": "https://www.doerfelverse.com/tracks/pour-over.mp3",
  "SWEATS": "https://www.doerfelverse.com/tracks/sweats.mp3",
  
  // Bloodshot Lies album tracks
  "Bloodshot Lies FUNK": "https://www.doerfelverse.com/tracks/bloodshot-lies.mp3",
  "Heartbreak (album version)": "https://www.doerfelverse.com/tracks/heartbreak.mp3",
  "Movie (album version)": "https://www.doerfelverse.com/tracks/movie.mp3",
  
  // Doerfel Family Bluegrass tracks
  "Hyssop Branches": "https://www.doerfelverse.com/tracks/hyssop-branches.mp3",
  "Bipolar": "https://www.doerfelverse.com/tracks/bipolar.mp3",
  "C.R.V.P.": "https://www.doerfelverse.com/tracks/crvp.mp3",
  
  // Recently resolved Top 100 tracks - Batch 1
  "Grey's Birthday": "https://op3.dev/e,pg=6fc2ad98-d4a8-5d70-9c68-62e9efc1209c/https://d12wklypp119aj.cloudfront.net/track/aad6e3b1-6589-4e22-b8ca-521f3d888263.mp3",
  "Wild and Free": "https://annipowellmusic.com/wp-content/MusicSideProject/MP3%20Masters%20and%20Copy%20of%20Cover/Wild%20and%20Free%20MP3/Wild%20and%20Free%20MP3%20Master.mp3",
  "Yellowhammer": "https://serve.podhome.fm/episode/048aea8e-476d-4dd2-675c-08ddd589f1dd/6389019306767115706fe2f866-8aa7-466e-bddc-cc1b698f723b.mp3",
  "Just to be a Dick": "https://music.behindthesch3m3s.com/wp-content/uploads/Mike_Epting/LedBetter/Red%20Wings/05-Just%20to%20be%20a%20Dick_04-01.mp3",
  
  // Recently resolved Top 100 tracks - Batch 2
  "Divided We Stand": "https://op3.dev/e/ipfspodcasting.net/e/cdn.kolomona.com/podcasts/lightning-thrashes/massacre-at-the-opera/cue-the-slaughter/6-divided-we-stand.mp3",
  "Dowsing": "https://feed.falsefinish.club/Temples/Temples%20-%20Cosmodrome/Temples%20-%20Cosmodrome%20-%2003%20Dowsing.mp3",
  "Medicine": "https://op3.dev/e,pg=5847498b-9db5-509f-860f-3f3c3c422698/https://d12wklypp119aj.cloudfront.net/track/0624efde-d0e5-4327-b67a-1773001a4693.mp3",
  "Sovereigns of the Air": "https://music.behindthesch3m3s.com/wp-content/uploads/Denim%20Cobra/Leather_Diamond/Denim%20Cobra%20-%20Sovereigns%20of%20the%20Air.mp3",
  "Dinosaurs": "https://op3.dev/e,pg=4068353f-f404-5d5c-937e-2c1582fcbf14/https://d12wklypp119aj.cloudfront.net/track/29043fc6-63b4-4054-8259-a491666d4650.mp3",
  "Light & Shade": "https://music.behindthesch3m3s.com/wp-content/uploads/Delta_OG/Aged_Friends_and_Old_Whiskey/Light%20And%20Shade.wav",
  "Dusty Old Man": "https://music.behindthesch3m3s.com/wp-content/uploads/2023/08/Dusty-Old-Man_Dusty-Old-Man.mp3"
};