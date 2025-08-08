import { useState, useEffect } from 'react';

interface Song {
  feedGuid: string;
  itemGuid: string;
  title: string | null;
  artist: string | null;
  feedUrl: string | null;
  feedTitle: string | null;
  episodeId?: number;
  feedId?: number;
}

interface ITDVPlaylistAlbumProps {
  song: Song;
  index: number;
}

function ITDVPlaylistAlbum({ song, index }: ITDVPlaylistAlbumProps) {
  const isResolved = song.title && song.artist;
  const displayTitle = song.title || 'Unknown Track';
  const displayArtist = song.artist || 'Unknown Artist';
  const displayFeedTitle = song.feedTitle || 'Into The Doerfel-Verse';

  return (
    <div className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors">
      {/* Album Art */}
      <div className="relative mb-4">
        <div className="w-full aspect-square bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
          {isResolved ? (
            <div className="text-center">
              <div className="text-4xl mb-2">🎵</div>
              <div className="text-xs text-white/80">Album Art</div>
            </div>
          ) : (
            <div className="text-center">
              <div className="text-4xl mb-2">❓</div>
              <div className="text-xs text-white/80">Unresolved</div>
            </div>
          )}
        </div>
        {isResolved && (
          <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
            V4V
          </div>
        )}
      </div>

      {/* Track Info */}
      <div className="space-y-2">
        <h3 className="font-semibold text-white truncate" title={displayTitle}>
          {displayTitle}
        </h3>
        
        <div className="text-sm text-gray-300 space-y-1">
          <p className="truncate" title={displayArtist}>
            {displayArtist}
          </p>
          <p className="truncate text-gray-400" title={displayFeedTitle}>
            {displayFeedTitle}
          </p>
          <p className="text-xs text-gray-500">
            ID: {song.feedGuid.substring(0, 8)}...
          </p>
        </div>

        {/* Duration */}
        <div className="text-sm text-gray-400">
          3:00
        </div>

        {/* Resolution Status */}
        {!isResolved && (
          <div className="text-xs text-orange-400 bg-orange-900/20 px-2 py-1 rounded">
            Unresolved Track
          </div>
        )}
      </div>
    </div>
  );
}

export function ITDVPlaylist() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSongs() {
      try {
        // Use the API endpoint from the root app directory running on port 3000
        const response = await fetch('http://localhost:3000/api/itdv-resolved-songs');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setSongs(data);
      } catch (err) {
        console.error('Error loading songs:', err);
        setError(err instanceof Error ? err.message : 'Failed to load songs');
      } finally {
        setLoading(false);
      }
    }

    loadSongs();
  }, []);

  const resolvedSongs = songs.filter(song => song.title && song.artist);
  const unresolvedSongs = songs.filter(song => !song.title || !song.artist);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Loading Music Collection...</h1>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Error Loading Music Collection</h1>
            <p className="text-red-300">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Music Collection</h1>
          <p className="text-xl text-gray-300 mb-4">Episodes 31-56</p>
          <div className="flex justify-center items-center gap-4 mb-6">
            <span className="text-lg">2024</span>
            <span className="text-lg">{songs.length} tracks</span>
            <button className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold transition-colors">
              PLAYLIST
            </button>
          </div>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Every music track played on Into The Doerfel-Verse podcast from episodes 31-56. 
            This playlist features remote items that reference tracks from the original ITDV feed.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mb-8">
          <button className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors">
            RSS Feed
          </button>
          <button className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition-colors">
            Podcasting 2.0
          </button>
          <button className="bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-lg font-semibold transition-colors">
            Remote Items
          </button>
        </div>

        {/* Stats */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-4">Tracks</h2>
          <p className="text-gray-300">
            Showing {songs.length} of {songs.length} tracks • {resolvedSongs.length} resolved
          </p>
        </div>

        {/* Tracks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {songs.map((song, index) => (
            <ITDVPlaylistAlbum
              key={`${song.feedGuid}-${song.itemGuid}`}
              song={song}
              index={index}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-400">
          <p>Generated from <a href="https://www.doerfelverse.com/" className="text-blue-300 hover:text-blue-200">Into The Doerfel-Verse</a> podcast</p>
          <p>Using Podcast Index namespace with <code className="bg-gray-800 px-2 py-1 rounded">podcast:remoteItem</code> tags</p>
        </div>
      </div>
    </div>
  );
}
