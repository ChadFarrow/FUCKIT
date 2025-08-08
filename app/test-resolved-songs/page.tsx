'use client';

import { useState, useEffect } from 'react';

interface Song {
  feedGuid: string;
  itemGuid: string;
  title: string;
  artist: string;
  feedUrl?: string;
  feedTitle?: string;
  episodeId?: number;
  feedId?: number;
}

export default function TestResolvedSongs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSongs = async () => {
      try {
        console.log('🔄 Testing resolved songs API...');
        const response = await fetch('/api/itdv-resolved-songs');
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ API Response:', data);
          setSongs(Array.isArray(data) ? data : []);
        } else {
          console.log('❌ API Error:', response.status);
          setError(`API Error: ${response.status}`);
        }
      } catch (err) {
        console.log('❌ Fetch Error:', err);
        setError(`Fetch Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadSongs();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Test Resolved Songs</h1>
      
      {loading && (
        <div className="text-yellow-400">Loading...</div>
      )}
      
      {error && (
        <div className="text-red-400 mb-4">Error: {error}</div>
      )}
      
      <div className="mb-4">
        <strong>Total Songs:</strong> {songs.length}
      </div>
      
      <div className="space-y-2">
        {songs.slice(0, 5).map((song, index) => (
          <div key={index} className="bg-gray-800 p-4 rounded">
            <div><strong>Title:</strong> {song.title}</div>
            <div><strong>Artist:</strong> {song.artist}</div>
            <div><strong>Feed:</strong> {song.feedTitle}</div>
          </div>
        ))}
      </div>
      
      {songs.length > 5 && (
        <div className="text-gray-400 mt-4">
          ... and {songs.length - 5} more songs
        </div>
      )}
    </div>
  );
}
