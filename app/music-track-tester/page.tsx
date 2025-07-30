'use client';

import { useState } from 'react';
import { MusicTrack, MusicFeed } from '@/lib/music-track-parser';

interface ExtractionResult {
  tracks: MusicTrack[];
  relatedFeeds: MusicFeed[];
  extractionStats: {
    totalTracks: number;
    tracksFromChapters: number;
    tracksFromValueSplits: number;
    tracksFromDescription: number;
    relatedFeedsFound: number;
    extractionTime: number;
  };
}

export default function MusicTrackTester() {
  const [feedUrl, setFeedUrl] = useState('https://www.doerfelverse.com/feeds/intothedoerfelverse.xml');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extractMusicTracks = async () => {
    if (!feedUrl.trim()) {
      setError('Please enter a feed URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/music-tracks?feedUrl=${encodeURIComponent(feedUrl)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract music tracks');
      }

      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'chapter': return 'bg-blue-100 text-blue-800';
      case 'value-split': return 'bg-green-100 text-green-800';
      case 'description': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎵 Music Track Extractor
          </h1>
          <p className="text-lg text-gray-600">
            Extract music tracks from podcast RSS feeds
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex gap-4">
            <input
              type="url"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="Enter RSS feed URL..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <button
              onClick={extractMusicTracks}
              disabled={isLoading}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Extracting...' : 'Extract Tracks'}
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="space-y-8">
            {/* Stats */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Extraction Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{result.extractionStats.totalTracks}</div>
                  <div className="text-sm text-gray-600">Total Tracks</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{result.extractionStats.tracksFromChapters}</div>
                  <div className="text-sm text-gray-600">From Chapters</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{result.extractionStats.tracksFromValueSplits}</div>
                  <div className="text-sm text-gray-600">From Value Splits</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{result.extractionStats.tracksFromDescription}</div>
                  <div className="text-sm text-gray-600">From Description</div>
                </div>
              </div>
              <div className="mt-4 text-center text-sm text-gray-500">
                Extraction time: {result.extractionStats.extractionTime}ms
              </div>
            </div>

            {/* Music Tracks */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Discovered Music Tracks ({result.tracks.length})
              </h2>
              
              {result.tracks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No music tracks found in this feed
                </div>
              ) : (
                <div className="space-y-4">
                  {result.tracks.map((track) => (
                    <div key={track.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{track.title}</h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSourceColor(track.source)}`}>
                              {track.source}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-2">Artist: {track.artist}</p>
                          <p className="text-gray-600 mb-2">Episode: {track.episodeTitle}</p>
                          
                          {track.startTime > 0 && (
                            <p className="text-gray-600 mb-2">
                              Time: {formatTime(track.startTime)} - {formatTime(track.endTime)} ({formatTime(track.duration)})
                            </p>
                          )}
                          
                          {track.description && (
                            <p className="text-gray-500 text-sm">{track.description}</p>
                          )}
                          
                          {track.valueForValue && (
                            <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                              <p className="text-sm text-green-700">
                                💡 Value-for-Value track with Lightning Network support
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {track.image && (
                          <img 
                            src={track.image} 
                            alt={track.title}
                            className="w-16 h-16 object-cover rounded-lg ml-4"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Related Feeds */}
            {result.relatedFeeds.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Related Music Feeds ({result.relatedFeeds.length})
                </h2>
                <div className="space-y-4">
                  {result.relatedFeeds.map((feed) => (
                    <div key={feed.id} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{feed.title}</h3>
                      <p className="text-gray-600 mb-2">{feed.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Relationship: {feed.relationship}</span>
                        <span>•</span>
                        <span>Tracks: {feed.tracks.length}</span>
                        <span>•</span>
                        <a 
                          href={feed.feedUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:text-purple-700"
                        >
                          View Feed
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 