#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

// Configuration
const CONFIG = {
  feedUrl: '',
  shortName: '', // e.g., 'itdv', 'lightning-thrashes'
  displayName: '', // e.g., 'Into The Doerfel-Verse'
  description: '', // e.g., 'Music Collection'
  episodeRange: '', // e.g., 'Episodes 1-60'
  backgroundImage: '', // URL to background image
  primaryColor: 'purple', // Color theme: purple, orange, blue, green, red
  trackCount: 0
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  args.forEach((arg, index) => {
    const [key, value] = arg.split('=');
    switch(key) {
      case '--feed':
        CONFIG.feedUrl = value;
        break;
      case '--short-name':
        CONFIG.shortName = value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        break;
      case '--display-name':
        CONFIG.displayName = value;
        break;
      case '--description':
        CONFIG.description = value;
        break;
      case '--episodes':
        CONFIG.episodeRange = value;
        break;
      case '--image':
        CONFIG.backgroundImage = value;
        break;
      case '--color':
        CONFIG.primaryColor = value;
        break;
      case '--tracks':
        CONFIG.trackCount = parseInt(value) || 0;
        break;
    }
  });
  
  // Validate required fields
  if (!CONFIG.feedUrl) {
    console.error('❌ Error: --feed is required');
    showHelp();
    process.exit(1);
  }
  
  if (!CONFIG.shortName) {
    console.error('❌ Error: --short-name is required');
    showHelp();
    process.exit(1);
  }
  
  if (!CONFIG.displayName) {
    CONFIG.displayName = CONFIG.shortName.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }
}

function showHelp() {
  console.log(`
🎵 Create Playlist from RSS Feed

Usage: node create-playlist-from-rss.js [options]

Required options:
  --feed=<url>              RSS feed URL
  --short-name=<name>       Short name for URLs (e.g., 'itdv', 'lightning-thrashes')

Optional options:
  --display-name=<name>     Display name (default: generated from short-name)
  --description=<text>      Playlist description (default: 'Music Collection')
  --episodes=<range>        Episode range (e.g., 'Episodes 1-60')
  --image=<url>            Background image URL
  --color=<color>          Theme color: purple, orange, blue, green, red (default: purple)
  --tracks=<number>        Number of tracks (default: will count from feed)

Example:
  node create-playlist-from-rss.js \\
    --feed="https://www.doerfelverse.com/feeds/intothedoerfelverse.xml" \\
    --short-name="itdv" \\
    --display-name="Into The Doerfel-Verse" \\
    --description="Music Collection" \\
    --episodes="Episodes 31-56" \\
    --image="https://www.doerfelverse.com/art/itdvchadf.png" \\
    --color="purple" \\
    --tracks=122
`);
}

// Parse RSS feed to get podcast info
async function parseFeed() {
  try {
    console.log('📡 Fetching RSS feed...');
    const response = await fetch(CONFIG.feedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status}`);
    }
    
    const xml = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    
    // Extract channel info
    const channel = doc.getElementsByTagName('channel')[0];
    const title = channel.getElementsByTagName('title')[0]?.textContent || CONFIG.displayName;
    const description = channel.getElementsByTagName('description')[0]?.textContent || '';
    const image = channel.getElementsByTagName('itunes:image')[0]?.getAttribute('href') || 
                  channel.getElementsByTagName('image')[0]?.getElementsByTagName('url')[0]?.textContent ||
                  CONFIG.backgroundImage;
    
    // Count items if not provided
    if (!CONFIG.trackCount) {
      const items = doc.getElementsByTagName('item');
      CONFIG.trackCount = items.length;
    }
    
    // Update config with parsed values
    if (!CONFIG.description) {
      CONFIG.description = description.substring(0, 100) + '...';
    }
    if (!CONFIG.backgroundImage) {
      CONFIG.backgroundImage = image;
    }
    
    console.log('✅ Feed parsed successfully');
    console.log(`📊 Found ${CONFIG.trackCount} items in feed`);
    
  } catch (error) {
    console.error('❌ Error parsing feed:', error.message);
    // Continue with provided values
  }
}

// Generate the playlist page component
function generatePlaylistPage() {
  const componentName = CONFIG.shortName.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('') + 'PlaylistAlbum';
  
  const pageContent = `'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Import ${CONFIG.displayName} Playlist component
const ${componentName} = dynamic(() => import('@/components/${componentName}'), {
  loading: () => (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="text-white">Loading ${CONFIG.displayName} Playlist...</div>
    </div>
  ),
  ssr: false
});

export default function ${CONFIG.shortName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}PlaylistPage() {
  // Use the same background style as album pages
  const backgroundStyle = {
    background: 'linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url(${CONFIG.backgroundImage}) center/cover fixed',
    backgroundAttachment: 'fixed'
  };

  return (
    <div 
      className="min-h-screen text-white relative"
      style={backgroundStyle}
    >
      <div className="container mx-auto px-6 py-8 pb-40">
        {/* Back button */}
        <Link 
          href="/" 
          className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Albums
        </Link>

        {/* Playlist Header - Album Style */}
        <div className="flex flex-col gap-6 mb-8">
          {/* Playlist Art */}
          <div className="relative group mx-auto w-[280px] h-[280px]">
            <img 
              src="${CONFIG.backgroundImage}"
              alt="${CONFIG.displayName}"
              className="rounded-lg object-cover shadow-2xl w-full h-full"
            />
          </div>
          
          {/* Playlist Info */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold leading-tight">${CONFIG.displayName}</h1>
            <p className="text-xl text-gray-300">${CONFIG.description}</p>
            ${CONFIG.episodeRange ? `<p className="text-lg text-gray-300 italic">${CONFIG.episodeRange}</p>` : ''}
            
            <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
              <span>2024</span>
              <span>${CONFIG.trackCount} tracks</span>
              <span className="bg-${CONFIG.primaryColor}-600 text-white px-2 py-1 rounded text-xs">PLAYLIST</span>
            </div>
            
            <p className="text-gray-300 text-center max-w-lg mx-auto leading-relaxed">
              Every music track played on ${CONFIG.displayName} podcast${CONFIG.episodeRange ? ` from ${CONFIG.episodeRange.toLowerCase()}` : ''}. 
              This playlist features remote items that reference tracks from the original feed.
            </p>

            {/* Badges */}
            <div className="flex flex-wrap justify-center gap-2">
              <span className="text-xs bg-${CONFIG.primaryColor}-500/20 text-${CONFIG.primaryColor}-300 px-2 py-1 rounded border border-${CONFIG.primaryColor}-500/30">
                RSS Feed
              </span>
              <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded border border-green-500/30">
                Podcasting 2.0
              </span>
              <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                Remote Items
              </span>
            </div>
          </div>
        </div>

        {/* Track List */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-4 md:p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Tracks</h2>
          <${componentName} />
        </div>

        {/* RSS Feed Info */}
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">RSS Feed Information</h3>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-400">Feed URL:</span>
              <code className="ml-2 text-blue-300 bg-gray-800/50 px-2 py-1 rounded">
                https://re.podtards.com/api/playlist/${CONFIG.shortName}-rss
              </code>
            </div>
            <div>
              <span className="text-gray-400">Original Source:</span>
              <span className="ml-2 text-white">${CONFIG.feedUrl}</span>
            </div>
            <div>
              <span className="text-gray-400">Format:</span>
              <span className="ml-2 text-white">Podcasting 2.0 RSS with podcast:remoteItem elements</span>
            </div>
            <div>
              <span className="text-gray-400">Compatibility:</span>
              <span className="ml-2 text-white">Works with all Podcasting 2.0 apps</span>
            </div>
            <div className="pt-2">
              <Link 
                href="/api/playlist/${CONFIG.shortName}-rss" 
                target="_blank"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View RSS Feed
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}`;

  return { pageContent, componentName };
}

// Generate the playlist album component
function generatePlaylistAlbumComponent(componentName) {
  const componentContent = `'use client';

import { useState, useEffect } from 'react';
import { useAudio } from '@/contexts/AudioContext';
import { Play, Pause, Music, ExternalLink, Download } from 'lucide-react';

interface ${CONFIG.displayName.replace(/[^a-zA-Z0-9]/g, '')}Track {
  id: string;
  title: string;
  artist: string;
  episodeTitle: string;
  duration: number;
  audioUrl?: string;
  startTime?: number;
  endTime?: number;
  valueForValue?: {
    resolved?: boolean;
    resolvedTitle?: string;
    resolvedArtist?: string;
    resolvedImage?: string;
    resolvedAudioUrl?: string;
  };
}

export default function ${componentName}() {
  const [tracks, setTracks] = useState<${CONFIG.displayName.replace(/[^a-zA-Z0-9]/g, '')}Track[]>([]);
  const [totalTracks, setTotalTracks] = useState(${CONFIG.trackCount});
  const [isLoading, setIsLoading] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { playTrack, isPlaying, pause, resume } = useAudio();

  useEffect(() => {
    setIsClient(true);
    load${CONFIG.displayName.replace(/[^a-zA-Z0-9]/g, '')}Tracks();
  }, []);

  const load${CONFIG.displayName.replace(/[^a-zA-Z0-9]/g, '')}Tracks = async () => {
    try {
      console.log('🔄 Loading ${CONFIG.displayName} tracks...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Try different data sources to find tracks
      let response;
      let isApiData = true;
      let dataSource = '';
      
      // Try the main API without filters first
      try {
        response = await fetch('/api/music-tracks/database?pageSize=1000', { signal: controller.signal });
        dataSource = 'API (no filter)';
        
        if (!response.ok || (await response.clone().json()).data?.tracks?.length === 0) {
          // Fall back to static file
          console.log('API endpoints returned no data, trying static file...');
          response = await fetch('/music-tracks.json', { signal: controller.signal });
          dataSource = 'Static file';
          isApiData = false;
        }
      } catch (error) {
        console.log('API failed, trying static data...', error);
        response = await fetch('/music-tracks.json', { signal: controller.signal });
        dataSource = 'Static file (fallback)';
        isApiData = false;
      }
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(\`Failed to load tracks: \${response.status} \${response.statusText}\`);
      }
      
      const data = await response.json();
      const allTracks = isApiData ? (data.data?.tracks || []) : (data.musicTracks || []);
      
      console.log('📊 Data source:', dataSource);
      console.log('📊 Total tracks fetched:', allTracks.length);
      
      // Filter for ${CONFIG.displayName} tracks
      const playlistTracks = allTracks.filter((track: any) => {
        const feedUrl = track.feedUrl?.toLowerCase() || '';
        const source = track.playlistInfo?.source?.toLowerCase() || '';
        
        // Match by feed URL
        if (feedUrl.includes('${CONFIG.feedUrl.toLowerCase().replace('https://', '').replace('http://', '').split('/')[0]}')) {
          return true;
        }
        
        // Match by playlist source
        if (source.includes('${CONFIG.shortName.toLowerCase()}')) {
          return true;
        }
        
        return false;
      });
      
      console.log('📊 ${CONFIG.displayName} tracks found:', playlistTracks.length);
      console.log('🎵 First few ${CONFIG.displayName} tracks:', playlistTracks.slice(0, 3));
      
      setTotalTracks(playlistTracks.length || ${CONFIG.trackCount});
      setTracks(playlistTracks);
    } catch (error) {
      console.error('❌ Error loading ${CONFIG.displayName} tracks:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Request timed out');
      }
      setTotalTracks(0);
      setTracks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayTrack = async (track: ${CONFIG.displayName.replace(/[^a-zA-Z0-9]/g, '')}Track, index: number) => {
    // If this is the current track and it's playing, pause it
    if (currentTrackIndex === index && isPlaying) {
      pause();
      return;
    }
    
    // If this is the current track and it's paused, resume it
    if (currentTrackIndex === index && !isPlaying) {
      resume();
      return;
    }
    
    // Otherwise, play this track
    setCurrentTrackIndex(index);
    if (track.valueForValue?.resolved && track.valueForValue?.resolvedAudioUrl) {
      await playTrack(track.valueForValue.resolvedAudioUrl);
    } else {
      await playTrack(track.audioUrl || '', track.startTime || 0, track.endTime || 300);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return \`\${mins}:\${secs.toString().padStart(2, '0')}\`;
  };

  // Don't render anything until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-white">Loading ${CONFIG.displayName} Playlist...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="text-sm text-gray-400">Loading ${CONFIG.displayName} tracks...</div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
            <div className="w-12 h-12 bg-gray-700 rounded"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
              <div className="h-3 bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="text-lg text-gray-300">⚠️ No ${CONFIG.displayName} tracks found</div>
        <div className="text-sm text-gray-400">
          The ${CONFIG.displayName} playlist tracks may be loading or temporarily unavailable.
        </div>
        <div className="text-xs text-gray-500">
          Check the browser console for more details or try refreshing the page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-400 mb-3">
        Showing {tracks.length} of {totalTracks} tracks
      </div>
      {tracks.filter(track => track && track.id && track.title).map((track, index) => {
        const isCurrentTrack = currentTrackIndex === index;
        const displayTitle = track.valueForValue?.resolved && track.valueForValue?.resolvedTitle
          ? track.valueForValue.resolvedTitle
          : track.title;
        const displayArtist = track.valueForValue?.resolved && track.valueForValue?.resolvedArtist
          ? track.valueForValue.resolvedArtist
          : track.artist;
        const displayImage = track.valueForValue?.resolved && track.valueForValue?.resolvedImage
          ? track.valueForValue.resolvedImage
          : "${CONFIG.backgroundImage}";
        
        return (
          <div 
            key={track.id} 
            className={\`flex items-center justify-between p-4 hover:bg-white/10 rounded-lg transition-colors group cursor-pointer \${
              isCurrentTrack ? 'bg-white/20' : ''
            }\`}
            onClick={() => handlePlayTrack(track, index)}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0 overflow-hidden rounded">
                <img 
                  src={displayImage}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                />
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity duration-200">
                  <button 
                    className="bg-white text-black rounded-full p-1 transform hover:scale-110 transition-all duration-200 shadow-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayTrack(track, index);
                    }}
                  >
                    {isCurrentTrack && isPlaying ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate text-sm md:text-base text-white">{displayTitle}</p>
                <p className="text-xs md:text-sm text-gray-400 truncate">
                  {displayArtist} • {track.episodeTitle || '${CONFIG.displayName}'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
              <span className="text-xs md:text-sm text-gray-400">
                {formatDuration(track.duration)}
              </span>
            </div>
          </div>
        );
      })}
      
      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <p className="text-sm text-gray-400">
          ${CONFIG.displayName} playlist with Value for Value support. 
          <a href="${CONFIG.feedUrl.replace('/feeds/', '/').replace('.xml', '')}" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 ml-1">
            Visit ${CONFIG.displayName}
          </a>
        </p>
      </div>
    </div>
  );
}`;

  return componentContent;
}

// Create the necessary files
async function createFiles() {
  try {
    // Parse feed if needed
    await parseFeed();
    
    console.log('🚀 Creating playlist pages for:', CONFIG.displayName);
    
    // Generate components
    const { pageContent, componentName } = generatePlaylistPage();
    const albumComponentContent = generatePlaylistAlbumComponent(componentName);
    
    // Create directories
    const playlistDir = path.join(__dirname, '..', 'app', 'playlist', `${CONFIG.shortName}-rss`);
    const componentDir = path.join(__dirname, '..', 'components');
    
    if (!fs.existsSync(playlistDir)) {
      fs.mkdirSync(playlistDir, { recursive: true });
    }
    
    // Write page file
    const pageFile = path.join(playlistDir, 'page.tsx');
    fs.writeFileSync(pageFile, pageContent);
    console.log(`✅ Created page: ${pageFile}`);
    
    // Write component file
    const componentFile = path.join(componentDir, `${componentName}.tsx`);
    fs.writeFileSync(componentFile, albumComponentContent);
    console.log(`✅ Created component: ${componentFile}`);
    
    // Instructions
    console.log(`
📋 Next Steps:
1. Create RSS endpoint at: /api/playlist/${CONFIG.shortName}-rss
2. Import playlist data using the import script
3. Test the page at: /playlist/${CONFIG.shortName}-rss

🎉 Playlist pages created successfully!
`);
    
  } catch (error) {
    console.error('❌ Error creating files:', error);
  }
}

// Main execution
async function main() {
  parseArgs();
  await createFiles();
}

main().catch(console.error);