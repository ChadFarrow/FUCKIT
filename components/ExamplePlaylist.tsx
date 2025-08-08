'use client';

import PlaylistAlbum, { PlaylistConfig } from './PlaylistAlbum';

// Example playlist data - this could come from any source (API, static data, etc.)
const EXAMPLE_TRACKS = [
  {
    "feedGuid": "example-feed-1",
    "itemGuid": "example-item-1",
    "title": "Example Song 1",
    "artist": "Example Artist",
    "feedUrl": "https://example.com/feed.xml",
    "feedTitle": "Example Album",
    "duration": 240
  },
  {
    "feedGuid": "example-feed-2", 
    "itemGuid": "example-item-2",
    "title": "Example Song 2",
    "artist": "Another Artist",
    "feedUrl": "https://example.com/feed2.xml", 
    "feedTitle": "Another Album",
    "duration": 180
  }
];

export default function ExamplePlaylist() {
  const config: PlaylistConfig = {
    name: 'Example Playlist',
    description: 'An example of how to create playlists using the reusable system',
    coverArt: 'https://via.placeholder.com/300x300?text=Example+Playlist',
    resolveAudioUrls: false, // Disable audio resolution for this example
    showResolutionStatus: false
  };

  const handleTrackResolved = (track: any) => {
    console.log(`✅ Example track resolved: ${track.title} by ${track.artist}`);
    
    // You could also:
    // - Save resolved tracks to a database
    // - Update UI state
    // - Trigger analytics events
    // - etc.
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Example Playlist</h2>
        <p className="text-gray-400">
          This demonstrates how easy it is to create new playlists using the reusable PlaylistAlbum component.
        </p>
      </div>
      
      <PlaylistAlbum 
        tracks={EXAMPLE_TRACKS} 
        config={config} 
        onTrackResolved={handleTrackResolved}
      />
      
      {/* Custom footer for this playlist */}
      <div className="mt-4 p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
        <h3 className="text-sm font-semibold text-blue-300 mb-2">How to create your own playlist:</h3>
        <ol className="text-sm text-gray-400 space-y-1">
          <li>1. Define your track data (from API, static data, etc.)</li>
          <li>2. Configure the PlaylistConfig with name, description, and settings</li>
          <li>3. Use the PlaylistAlbum component with your tracks and config</li>
          <li>4. Add custom UI elements as needed (footers, headers, etc.)</li>
        </ol>
      </div>
    </div>
  );
}

/*
USAGE EXAMPLES:

// For a simple playlist without audio resolution:
const simpleConfig = {
  name: 'My Playlist',
  description: 'A simple playlist',
  coverArt: '/my-playlist-art.jpg',
  resolveAudioUrls: false,
  showResolutionStatus: false
};

// For a dynamic playlist with audio resolution:
const dynamicConfig = {
  name: 'Dynamic Playlist', 
  description: 'Playlist with real audio URLs',
  coverArt: '/dynamic-playlist-art.jpg',
  resolveAudioUrls: true,
  showResolutionStatus: true
};

// For a podcast-specific playlist:
const podcastConfig = {
  name: 'Podcast Music Picks',
  description: 'Music featured in our podcast episodes',
  coverArt: '/podcast-art.jpg',
  resolveAudioUrls: true,
  showResolutionStatus: true
};
*/