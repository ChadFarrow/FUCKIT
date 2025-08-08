'use client';

import { useState } from 'react';
import { MusicTrackExtractionResult } from '@/lib/music-track-parser';

export default function MusicTestPage() {
  const [feedUrl, setFeedUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<MusicTrackExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testFeeds = [
    { name: 'Lightning Thrashes Playlist', url: 'http://localhost:3000/001-to-060-lightning-thrashes-playlist.xml' },
    { name: 'Doerfel-Verse', url: 'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml' },
    { name: "Mike's Mix Tape", url: 'https://feeds.podcastmirror.com/mikesmixedtape' }
  ];

  const testFeed = async (url: string) => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    setFeedUrl(url);

    try {
      const response = await fetch(`/api/music-tracks?feedUrl=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (data.success) {
        setResults(data.data);
      } else {
        setError(data.error || 'Failed to extract tracks');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Music Track Parser Test</h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Test Feeds</h2>
        <div className="space-y-2">
          {testFeeds.map((feed) => (
            <button
              key={feed.url}
              onClick={() => testFeed(feed.url)}
              className="block w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              disabled={isLoading}
            >
              <span className="font-medium">{feed.name}</span>
              <span className="text-sm text-gray-400 block">{feed.url}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Custom Feed URL</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            placeholder="Enter RSS feed URL"
            className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-blue-500 focus:outline-none"
            disabled={isLoading}
          />
          <button
            onClick={() => testFeed(feedUrl)}
            disabled={isLoading || !feedUrl}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Testing...' : 'Test Feed'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
          <h3 className="font-semibold text-red-400 mb-2">Error</h3>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {results && (
        <div className="space-y-8">
          <div className="p-4 bg-white/5 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">Extraction Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Total Tracks:</span>
                <span className="ml-2 font-medium">{results.extractionStats.totalTracks}</span>
              </div>
              <div>
                <span className="text-gray-400">From Chapters:</span>
                <span className="ml-2 font-medium">{results.extractionStats.tracksFromChapters}</span>
              </div>
              <div>
                <span className="text-gray-400">From Value Splits:</span>
                <span className="ml-2 font-medium">{results.extractionStats.tracksFromValueSplits}</span>
              </div>
              <div>
                <span className="text-gray-400">From Description:</span>
                <span className="ml-2 font-medium">{results.extractionStats.tracksFromDescription}</span>
              </div>
              <div>
                <span className="text-gray-400">Related Feeds:</span>
                <span className="ml-2 font-medium">{results.extractionStats.relatedFeedsFound}</span>
              </div>
              <div>
                <span className="text-gray-400">Extraction Time:</span>
                <span className="ml-2 font-medium">{results.extractionStats.extractionTime}ms</span>
              </div>
            </div>
          </div>

          {results.tracks.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-4">Extracted Tracks ({results.tracks.length})</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.tracks.map((track, index) => (
                  <div key={track.id} className="p-3 bg-white/5 rounded-lg text-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <span className="font-medium">{index + 1}. {track.title}</span>
                        <span className="text-gray-400 ml-2">by {track.artist}</span>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        track.source === 'chapter' ? 'bg-blue-500/20 text-blue-300' :
                        track.source === 'value-split' ? 'bg-green-500/20 text-green-300' :
                        track.source === 'description' ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-purple-500/20 text-purple-300'
                      }`}>
                        {track.source}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Episode: {track.episodeTitle}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.relatedFeeds.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-4">Related Feeds ({results.relatedFeeds.length})</h3>
              <div className="space-y-2">
                {results.relatedFeeds.map((feed) => (
                  <div key={feed.id} className="p-3 bg-white/5 rounded-lg">
                    <div className="font-medium">{feed.title}</div>
                    <div className="text-sm text-gray-400">{feed.feedUrl}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Relationship: {feed.relationship}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}