'use client';

import { useState } from 'react';

interface AddRSSFeedProps {
  onAddFeed: (feedUrl: string) => void;
  isLoading?: boolean;
}

export default function AddRSSFeed({ onAddFeed, isLoading = false }: AddRSSFeedProps) {
  const [feedUrl, setFeedUrl] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check passphrase first
    if (passphrase.trim().toLowerCase() !== 'doerfel') {
      setError('Incorrect passphrase. Please try again.');
      return;
    }
    
    // Basic URL validation
    if (!feedUrl.trim()) {
      setError('Please enter a RSS feed URL');
      return;
    }

    try {
      const url = new URL(feedUrl.trim());
      if (!url.protocol.startsWith('http')) {
        setError('Please enter a valid HTTP/HTTPS URL');
        return;
      }
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    // Clear any previous errors
    setError('');
    
    // Add the feed
    onAddFeed(feedUrl.trim());
    
    // Reset form
    setFeedUrl('');
    setPassphrase('');
    setIsExpanded(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFeedUrl(e.target.value);
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handlePassphraseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassphrase(e.target.value);
    // Clear error when user starts typing
    if (error) setError('');
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4 mb-6">
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          disabled={isLoading}
          className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Add RSS Feed</span>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="passphrase" className="block text-sm font-medium text-gray-300 mb-2">
              Passphrase
            </label>
            <input
              type="password"
              id="passphrase"
              value={passphrase}
              onChange={handlePassphraseChange}
              placeholder="Enter passphrase to add feeds"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label htmlFor="feedUrl" className="block text-sm font-medium text-gray-300 mb-2">
              RSS Feed URL
            </label>
            <input
              type="url"
              id="feedUrl"
              value={feedUrl}
              onChange={handleInputChange}
              placeholder="https://example.com/feed.xml"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            {error && (
              <p className="mt-1 text-sm text-red-400">{error}</p>
            )}
          </div>
          
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading || !feedUrl.trim() || !passphrase.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Adding...' : 'Add Feed'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                setFeedUrl('');
                setPassphrase('');
                setError('');
              }}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
} 