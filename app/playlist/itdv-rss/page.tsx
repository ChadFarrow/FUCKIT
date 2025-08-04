'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface PlaylistStats {
  totalTracks: number;
  episodes: number;
  dateRange: string;
}

export default function ITDVRSSPlaylistPage() {
  const [stats, setStats] = useState<PlaylistStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Parse the XML to get stats
    fetch('/api/playlist/itdv-rss')
      .then(res => res.text())
      .then(xml => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        const items = doc.querySelectorAll('item');
        
        // Extract episode numbers from titles
        const episodes = new Set<string>();
        items.forEach(item => {
          const title = item.querySelector('title')?.textContent || '';
          const episodeMatch = title.match(/Episode (\d+)/);
          if (episodeMatch) {
            episodes.add(episodeMatch[1]);
          }
        });

        setStats({
          totalTracks: items.length,
          episodes: episodes.size,
          dateRange: `Episodes ${Math.min(...Array.from(episodes).map(Number))} - ${Math.max(...Array.from(episodes).map(Number))}`
        });
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading playlist stats:', err);
        setLoading(false);
      });
  }, []);

  const rssUrl = `${window.location.origin}/api/playlist/itdv-rss`;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Into The Doerfel-Verse Music RSS</h1>
          <p className="text-xl text-gray-300 mb-6">
            Podcasting 2.0 compliant RSS feed for music from Into The Doerfel-Verse
          </p>
          
          {/* Stats */}
          {loading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-700 rounded w-64 mx-auto mb-4"></div>
            </div>
          ) : stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="text-3xl font-bold text-blue-400">{stats.totalTracks}</div>
                <div className="text-gray-300">Total Tracks</div>
              </div>
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="text-3xl font-bold text-green-400">{stats.episodes}</div>
                <div className="text-gray-300">Episodes</div>
              </div>
              <div className="bg-gray-800 p-6 rounded-lg">
                <div className="text-lg font-bold text-purple-400">{stats.dateRange}</div>
                <div className="text-gray-300">Coverage</div>
              </div>
            </div>
          )}
        </div>

        {/* RSS Feed Info */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">RSS Feed Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                RSS Feed URL:
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={rssUrl}
                  readOnly
                  className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-l border border-gray-600"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(rssUrl)}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-r transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold text-gray-300 mb-2">Features:</h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Podcasting 2.0 compliant</li>
                  <li>• Value4Value (V4V) support</li>
                  <li>• Cross-feed references</li>
                  <li>• Music track metadata</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-300 mb-2">Compatible Apps:</h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Fountain</li>
                  <li>• Podverse</li>
                  <li>• Breez</li>
                  <li>• Any Podcasting 2.0 app</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <a
            href="/api/playlist/itdv-rss"
            download="ITDV-playlist.xml"
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-center transition-colors"
          >
            📥 Download RSS
          </a>
          
          <a
            href={`podcast://${rssUrl}`}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg text-center transition-colors"
          >
            🎧 Open in App
          </a>
          
          <Link
            href="/playlist/itdv"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-center transition-colors"
          >
            🎵 View Web Player
          </Link>
        </div>

        {/* Technical Details */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Technical Details</h2>
          <div className="text-sm text-gray-300 space-y-2">
            <p><strong>Format:</strong> RSS 2.0 with Podcasting 2.0 namespace</p>
            <p><strong>Medium:</strong> musicL (Music Library)</p>
            <p><strong>Encoding:</strong> UTF-8</p>
            <p><strong>Last Updated:</strong> August 4, 2025</p>
            <p><strong>Feed GUID:</strong> Generated from Doerfel-Verse content</p>
          </div>
        </div>

        {/* Back to Playlists */}
        <div className="text-center mt-8">
          <Link
            href="/playlist"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            ← Back to All Playlists
          </Link>
        </div>
      </div>
    </div>
  );
} 