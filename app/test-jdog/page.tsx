'use client';

import { useState, useEffect } from 'react';
import { RSSParser, RSSAlbum } from '@/lib/rss-parser';

export default function TestJdogPage() {
  const [album, setAlbum] = useState<RSSAlbum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function testJdogFeed() {
      try {
        console.log('Testing Jdog feed parsing...');
        const result = await RSSParser.parseAlbumFeed('/api/fetch-rss?url=' + encodeURIComponent('https://www.thisisjdog.com/media/ring-that-bell.xml'));
        console.log('Jdog parse result:', result);
        
        if (result) {
          setAlbum(result);
        } else {
          setError('Failed to parse Jdog RSS feed');
        }
      } catch (err) {
        console.error('Error testing Jdog feed:', err);
        setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    }
    
    testJdogFeed();
  }, []);

  return (
    <div className="min-h-screen text-white bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <h1 className="text-3xl font-bold mb-8">Test Jdog RSS Feed Parsing</h1>
      
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-400">Error: {error}</p>}
      
      {album && (
        <div className="bg-black/20 p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Album: {album.title}</h2>
          <p className="mb-2"><strong>Artist:</strong> {album.artist}</p>
          <p className="mb-2"><strong>Description:</strong> {album.description}</p>
          <p className="mb-2"><strong>Cover Art URL:</strong> {album.coverArt || 'NOT FOUND'}</p>
          <p className="mb-2"><strong>Tracks:</strong> {album.tracks.length}</p>
          
          {album.coverArt && (
            <div className="mt-4">
              <p className="mb-2"><strong>Cover Art Preview:</strong></p>
              <img 
                src={album.coverArt} 
                alt={album.title}
                className="max-w-xs rounded-lg"
                onLoad={() => console.log('Image loaded successfully')}
                onError={() => console.error('Image failed to load')}
              />
            </div>
          )}
          
          <div className="mt-6">
            <h3 className="text-xl font-bold mb-2">Track List:</h3>
            {album.tracks.map((track, index) => (
              <div key={index} className="mb-1">
                {index + 1}. {track.title} ({track.duration})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}