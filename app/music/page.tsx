'use client';

import { useState, useEffect } from 'react';
import { Podcast } from '@/types/podcast';
import { PodcastIndexClient } from '@/lib/podcast-index';
import PodcastCard from '@/components/PodcastCard';
import SearchBar from '@/components/SearchBar';
import Header from '@/components/Header';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Music, Mic, Headphones } from 'lucide-react';

export default function MusicPage() {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMusicPodcasts();
  }, []);

  const loadMusicPodcasts = async () => {
    try {
      setLoading(true);
      setError(null);
      // Search for music-related podcasts
      const response = await PodcastIndexClient.searchPodcasts({ 
        q: 'music', 
        max: 30,
        cat: 'Music'
      });
      setPodcasts(response.feeds || []);
    } catch (err) {
      setError('Failed to load music podcasts. Please check your API credentials.');
      console.error('Error loading music podcasts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      loadMusicPodcasts();
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await PodcastIndexClient.searchPodcasts({ 
        q: query, 
        max: 30,
        cat: 'Music'
      });
      setPodcasts(response.feeds || []);
      setSearchQuery(query);
    } catch (err) {
      setError('Failed to search music podcasts. Please try again.');
      console.error('Error searching music podcasts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    loadMusicPodcasts();
  };

  const musicCategories = [
    { name: 'Jazz', icon: Music, query: 'jazz' },
    { name: 'Rock', icon: Headphones, query: 'rock' },
    { name: 'Electronic', icon: Mic, query: 'electronic' },
    { name: 'Classical', icon: Music, query: 'classical' },
    { name: 'Hip Hop', icon: Mic, query: 'hip hop' },
    { name: 'Folk', icon: Music, query: 'folk' },
  ];

  const handleCategoryClick = async (query: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await PodcastIndexClient.searchPodcasts({ 
        q: query, 
        max: 30,
        cat: 'Music'
      });
      setPodcasts(response.feeds || []);
      setSearchQuery(query);
    } catch (err) {
      setError('Failed to load category podcasts. Please try again.');
      console.error('Error loading category podcasts:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Music Podcasts & Feeds
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              Discover amazing music podcasts, interviews, and audio content
            </p>
            <SearchBar onSearch={handleSearch} onClear={handleClearSearch} />
          </div>

          {/* Music Categories */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Music Categories
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {musicCategories.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.name}
                    onClick={() => handleCategoryClick(category.query)}
                    className="flex flex-col items-center p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100"
                  >
                    <Icon className="h-8 w-8 text-primary-600 mb-2" />
                    <span className="text-sm font-medium text-gray-900">{category.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {searchQuery && (
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Search Results for "{searchQuery}"
              </h2>
              <button
                onClick={handleClearSearch}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                ← Back to Music Podcasts
              </button>
            </div>
          )}

          {!searchQuery && (
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Featured Music Podcasts
              </h2>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner />
            </div>
          ) : podcasts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {podcasts.map((podcast) => (
                <PodcastCard key={podcast.id} podcast={podcast} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {searchQuery ? 'No music podcasts found for your search.' : 'No music podcasts available.'}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 