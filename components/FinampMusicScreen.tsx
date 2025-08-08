'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FinampAlbumCard from '@/components/FinampAlbumCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import { RSSAlbum } from '@/lib/rss-parser';
import { generatePublisherSlug } from '@/lib/url-utils';
import { useAudio } from '@/contexts/AudioContext';
import { AppError, ErrorCodes } from '@/lib/error-utils';
import { toast } from '@/components/Toast';

interface FinampMusicScreenProps {
  initialAlbums?: RSSAlbum[];
  initialPublishers?: Array<{
    title: string;
    count: number;
    url: string;
  }>;
}

const FinampMusicScreen: React.FC<FinampMusicScreenProps> = ({
  initialAlbums = [],
  initialPublishers = []
}) => {
  const router = useRouter();
  const { setCurrentPlayingAlbum } = useAudio();
  
  // State management
  const [albums, setAlbums] = useState<RSSAlbum[]>(initialAlbums);
  const [publishers, setPublishers] = useState(initialPublishers);
  const [loading, setLoading] = useState(!initialAlbums.length);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'albums' | 'artists' | 'recent'>('albums');
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load albums if not provided initially
  useEffect(() => {
    if (!initialAlbums.length) {
      loadAlbums();
    }
  }, [initialAlbums.length]);

  const loadAlbums = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/albums');
      if (!response.ok) {
        throw new AppError(ErrorCodes.API_ERROR, `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAlbums(data.albums || []);
      setPublishers(data.publishers || []);
    } catch (err) {
      const errorMessage = err instanceof AppError ? err.message : 'Failed to load content';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort albums
  const filteredAlbums = albums
    .filter(album => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        album.title.toLowerCase().includes(query) ||
        album.artist.toLowerCase().includes(query) ||
        album.description?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'artist':
          comparison = a.artist.localeCompare(b.artist);
          break;
        case 'date':
          comparison = new Date(a.pubDate || 0).getTime() - new Date(b.pubDate || 0).getTime();
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setIsSearching(query.length > 0);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleShuffleAll = () => {
    if (filteredAlbums.length === 0) return;
    
    const randomAlbum = filteredAlbums[Math.floor(Math.random() * filteredAlbums.length)];
    setCurrentPlayingAlbum(randomAlbum);
    toast.success(`Playing ${randomAlbum.title} by ${randomAlbum.artist}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <LoadingSpinner size="large" />
          <p className="finamp-body-large" style={{ color: 'var(--finamp-on-surface-variant)' }}>
            Loading your music...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" 
               style={{ backgroundColor: 'var(--finamp-tertiary-container)' }}>
            <svg className="w-8 h-8" style={{ color: 'var(--finamp-tertiary)' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </div>
          <h2 className="finamp-headline-medium" style={{ color: 'var(--finamp-on-surface)' }}>
            Something went wrong
          </h2>
          <p className="finamp-body-medium" style={{ color: 'var(--finamp-on-surface-variant)' }}>
            {error}
          </p>
          <button
            onClick={loadAlbums}
            className="finamp-button finamp-button--filled"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ paddingBottom: '120px' }}>
      {/* Finamp-style App Bar */}
      <header className="sticky top-0 z-40 backdrop-blur-md border-b"
              style={{ 
                backgroundColor: 'var(--finamp-surface-container)',
                borderColor: 'var(--finamp-outline-variant)'
              }}>
        <div className="finamp-container">
          <div className="flex items-center justify-between h-16">
            {/* Logo/Title */}
            <div className="flex items-center gap-3">
              <h1 className="finamp-title-large" style={{ color: 'var(--finamp-on-surface)' }}>
                Project StableKraft
              </h1>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-md mx-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5" style={{ color: 'var(--finamp-on-surface-variant)' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search albums, artists..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 rounded-full border-0 focus:ring-2 transition-all"
                  style={{
                    backgroundColor: 'var(--finamp-surface-variant)',
                    color: 'var(--finamp-on-surface)',
                    fontSize: 'var(--finamp-text-body-medium)',
                    outline: 'none',
                    boxShadow: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.backgroundColor = 'var(--finamp-surface-container-high)';
                    e.target.style.boxShadow = '0 0 0 2px var(--finamp-primary)';
                  }}
                  onBlur={(e) => {
                    e.target.style.backgroundColor = 'var(--finamp-surface-variant)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg className="h-5 w-5" style={{ color: 'var(--finamp-on-surface-variant)' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleShuffleAll}
                className="finamp-button finamp-button--text"
                disabled={filteredAlbums.length === 0}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
                </svg>
                Shuffle all
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="finamp-container finamp-p-lg">
        {/* Tabs */}
        <div className="mb-6">
          <div className="flex items-center gap-1 p-1 rounded-lg" 
               style={{ backgroundColor: 'var(--finamp-surface-variant)' }}>
            {(['albums', 'artists', 'recent'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all capitalize ${
                  activeTab === tab
                    ? 'shadow-sm'
                    : ''
                }`}
                style={{
                  backgroundColor: activeTab === tab ? 'var(--finamp-primary)' : 'transparent',
                  color: activeTab === tab ? 'var(--finamp-on-primary)' : 'var(--finamp-on-surface-variant)'
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="finamp-body-medium" style={{ color: 'var(--finamp-on-surface-variant)' }}>
              Sort by:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="finamp-button finamp-button--outlined border-0"
              style={{
                backgroundColor: 'var(--finamp-surface-variant)',
                color: 'var(--finamp-on-surface)',
                padding: '8px 12px',
                borderRadius: 'var(--finamp-radius-sm)'
              }}
            >
              <option value="date">Date</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
            </select>
          </div>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="finamp-button finamp-button--icon"
          >
            <svg 
              className={`w-5 h-5 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`}
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M7 14l5-5 5 5z"/>
            </svg>
          </button>
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="finamp-body-medium" style={{ color: 'var(--finamp-on-surface-variant)' }}>
            {isSearching ? (
              <>
                {filteredAlbums.length} result{filteredAlbums.length !== 1 ? 's' : ''} for "{searchQuery}"
              </>
            ) : (
              <>
                {filteredAlbums.length} album{filteredAlbums.length !== 1 ? 's' : ''} available
              </>
            )}
          </p>
        </div>

        {/* Albums Grid */}
        {filteredAlbums.length > 0 ? (
          <div className="finamp-grid finamp-grid--albums">
            {filteredAlbums.map((album) => (
              <FinampAlbumCard
                key={album.id}
                album={album}
                showText={true}
                size="medium"
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                 style={{ backgroundColor: 'var(--finamp-surface-variant)' }}>
              <svg className="w-8 h-8" style={{ color: 'var(--finamp-on-surface-variant)' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h3 className="finamp-title-medium mb-2" style={{ color: 'var(--finamp-on-surface)' }}>
              {isSearching ? 'No results found' : 'No albums available'}
            </h3>
            <p className="finamp-body-medium" style={{ color: 'var(--finamp-on-surface-variant)' }}>
              {isSearching 
                ? `Try adjusting your search term "${searchQuery}"`
                : 'Check back later for new content'
              }
            </p>
            {isSearching && (
              <button
                onClick={clearSearch}
                className="finamp-button finamp-button--text mt-4"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default FinampMusicScreen;
