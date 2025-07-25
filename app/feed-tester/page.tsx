'use client';

import { useState } from 'react';
import { RSSParser, RSSAlbum, RSSPublisherItem } from '@/lib/rss-parser';

interface FeedTestResult {
  success: boolean;
  data?: RSSAlbum[] | RSSPublisherItem[];
  error?: string;
  metadata?: {
    title?: string;
    description?: string;
    artist?: string;
    coverArt?: string;
  };
  validationErrors?: string[];
  processingTime?: number;
}

// Helper function to parse publisher feed from XML string
const parsePublisherFeedFromXML = (xmlText: string): RSSPublisherItem[] => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Check for parsing errors
    const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parserError) {
      throw new Error('Invalid XML format');
    }
    
    // Extract channel info
    const channels = xmlDoc.getElementsByTagName('channel');
    if (!channels || channels.length === 0) {
      throw new Error('Invalid RSS feed: no channel found');
    }
    const channel = channels[0];
    
    const publisherItems: RSSPublisherItem[] = [];
    
    // Look for podcast:remoteItem elements with medium="music"
    const remoteItems = Array.from(channel.getElementsByTagName('podcast:remoteItem'));
    
    remoteItems.forEach((item: unknown) => {
      const element = item as Element;
      const medium = element.getAttribute('medium');
      const feedGuid = element.getAttribute('feedGuid');
      const feedUrl = element.getAttribute('feedUrl');
      const title = element.getAttribute('title') || element.textContent?.trim();
      
      if (medium === 'music' && feedGuid && feedUrl) {
        publisherItems.push({
          feedGuid,
          feedUrl,
          medium,
          title
        });
      }
    });
    
    console.log(`🏢 Found ${publisherItems.length} music items in publisher feed XML`);
    return publisherItems;
    
  } catch (error) {
    console.error('❌ Error parsing publisher feed from XML:', error);
    throw error;
  }
};

// Helper function to extract metadata from XML string
const extractMetadataFromXML = (xmlText: string): { title?: string; description?: string; artist?: string; coverArt?: string } | null => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Check for parsing errors
    const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parserError) {
      return null;
    }
    
    // Extract channel info
    const channels = xmlDoc.getElementsByTagName('channel');
    if (!channels || channels.length === 0) {
      return null;
    }
    const channel = channels[0];
    
    const titleElement = channel.getElementsByTagName('title')[0];
    const title = titleElement?.textContent?.trim() || '';
    const descriptionElement = channel.getElementsByTagName('description')[0];
    const description = descriptionElement?.textContent?.trim() || '';
    
    // Extract artist from title or author
    let artist = title; // Use title as default artist name
    const authorElements = channel.getElementsByTagName('itunes:author');
    const authorElement = authorElements.length > 0 ? authorElements[0] : channel.getElementsByTagName('author')[0];
    if (authorElement) {
      artist = authorElement.textContent?.trim() || artist;
    }
    
    // Extract cover art
    let coverArt: string | null = null;
    let imageElement: Element | null = channel.getElementsByTagName('itunes:image')[0] || null;
    if (!imageElement) {
      // Fallback to querySelector with escaped namespace
      imageElement = channel.querySelector('itunes\\:image');
    }
    
    if (imageElement) {
      coverArt = imageElement.getAttribute('href') || null;
    }
    if (!coverArt) {
      const imageUrl = channel.querySelector('image url');
      if (imageUrl) {
        coverArt = imageUrl.textContent?.trim() || null;
      }
    }
    
    return {
      title,
      description,
      artist,
      coverArt: coverArt || undefined
    };
    
  } catch (error) {
    console.error('❌ Error extracting metadata from XML:', error);
    return null;
  }
};

export default function FeedTesterPage() {
  const [feedUrl, setFeedUrl] = useState('');
  const [feedText, setFeedText] = useState('');
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FeedTestResult | null>(null);
  const [testType, setTestType] = useState<'albums' | 'publisher'>('albums');

  const testFeed = async () => {
    if (inputMode === 'url' && !feedUrl.trim()) {
      setResult({
        success: false,
        error: 'Please enter a valid RSS feed URL'
      });
      return;
    }
    if (inputMode === 'text' && !feedText.trim()) {
      setResult({
        success: false,
        error: 'Please paste RSS XML text'
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    const startTime = Date.now();

    try {
      let data: RSSAlbum[] | RSSPublisherItem[] | null = null;
      let metadata: { title?: string; description?: string; artist?: string; coverArt?: string } | undefined = undefined;
      const validationErrors: string[] = [];

      if (inputMode === 'url') {
        // Test feed parsing based on type (URL)
        if (testType === 'albums') {
          data = await RSSParser.parsePublisherFeedAlbums(feedUrl);
          const feedInfo = await RSSParser.parsePublisherFeedInfo(feedUrl);
          metadata = feedInfo || undefined;
        } else {
          data = await RSSParser.parsePublisherFeed(feedUrl);
        }
      } else {
        // Test feed parsing based on pasted XML
        if (testType === 'albums') {
          // For albums, we need to parse the XML and extract individual album feeds
          // This is more complex and would require additional implementation
          throw new Error('XML input for albums feeds is not yet supported. Please use URL mode for albums.');
        } else {
          // For publisher feeds, parse the XML directly
          data = parsePublisherFeedFromXML(feedText);
          metadata = extractMetadataFromXML(feedText) || undefined;
        }
      }

      const processingTime = Date.now() - startTime;

      // Basic validation
      if (!data || data.length === 0) {
        validationErrors.push('No data found in feed');
      }

      if (testType === 'albums' && Array.isArray(data)) {
        const albums = data as RSSAlbum[];
        albums.forEach((album, index) => {
          if (!album.title) validationErrors.push(`Album ${index + 1}: Missing title`);
          if (!album.artist) validationErrors.push(`Album ${index + 1}: Missing artist`);
          if (!album.tracks || album.tracks.length === 0) {
            validationErrors.push(`Album ${index + 1}: No tracks found`);
          }
        });
      }

      if (testType === 'publisher' && Array.isArray(data)) {
        const publisherItems = data as RSSPublisherItem[];
        publisherItems.forEach((item, index) => {
          if (!item.feedGuid) validationErrors.push(`Publisher item ${index + 1}: Missing feedGuid`);
          if (!item.feedUrl) validationErrors.push(`Publisher item ${index + 1}: Missing feedUrl`);
          if (!item.medium) validationErrors.push(`Publisher item ${index + 1}: Missing medium`);
        });
      }

      setResult({
        success: true,
        data,
        metadata,
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
        processingTime
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTime
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResult(null);
    setFeedUrl('');
    setFeedText('');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            RSS Feed Tester
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Test and validate your RSS feeds in real-time. Parse publisher feeds and albums to ensure they're working correctly.
          </p>
          <div className="mt-4 text-sm text-gray-500">
            <p>Example feeds to test:</p>
            <ul className="mt-2 space-y-1">
              <li>• Publisher Feed: <code className="bg-gray-100 px-1 rounded">/api/test-feed?feed=test-doerfels-publisher</code></li>
              <li>• Publisher Feed: <code className="bg-gray-100 px-1 rounded">/api/test-feed?feed=doerfels-publisher</code></li>
            </ul>
          </div>
        </div>

        {/* Input Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="space-y-4">
            {/* Input Mode Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Input Mode
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="url"
                    checked={inputMode === 'url'}
                    onChange={() => setInputMode('url')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">URL</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="text"
                    checked={inputMode === 'text'}
                    onChange={() => setInputMode('text')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Paste XML</span>
                </label>
              </div>
            </div>

            {/* Test Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Type
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="albums"
                    checked={testType === 'albums'}
                    onChange={(e) => setTestType(e.target.value as 'albums' | 'publisher')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Albums Feed</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="publisher"
                    checked={testType === 'publisher'}
                    onChange={(e) => setTestType(e.target.value as 'albums' | 'publisher')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Publisher Feed</span>
                </label>
              </div>
            </div>

            {/* URL or XML Input */}
            {inputMode === 'url' ? (
              <div>
                <label htmlFor="feedUrl" className="block text-sm font-medium text-gray-700 mb-2">
                  RSS Feed URL
                </label>
                <input
                  type="url"
                  id="feedUrl"
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                />
              </div>
            ) : (
              <div>
                <label htmlFor="feedText" className="block text-sm font-medium text-gray-700 mb-2">
                  Paste RSS XML
                </label>
                <textarea
                  id="feedText"
                  value={feedText}
                  onChange={(e) => setFeedText(e.target.value)}
                  placeholder="Paste your RSS XML here..."
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-4">
              <button
                onClick={testFeed}
                disabled={isLoading || (inputMode === 'url' ? !feedUrl.trim() : !feedText.trim())}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Testing Feed...
                  </span>
                ) : (
                  'Test Feed'
                )}
              </button>
              <button
                onClick={clearResults}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                Test Results
              </h2>
              <div className="flex items-center space-x-4">
                {result.processingTime && (
                  <span className="text-sm text-gray-500">
                    Processed in {result.processingTime}ms
                  </span>
                )}
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  result.success 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {result.success ? 'Success' : 'Error'}
                </div>
              </div>
            </div>

            {result.success ? (
              <div className="space-y-6">
                {/* Metadata */}
                {result.metadata && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Feed Metadata</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {result.metadata.title && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Title:</span>
                          <p className="text-gray-900">{result.metadata.title}</p>
                        </div>
                      )}
                      {result.metadata.description && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Description:</span>
                          <p className="text-gray-900">{result.metadata.description}</p>
                        </div>
                      )}
                      {result.metadata.artist && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Artist:</span>
                          <p className="text-gray-900">{result.metadata.artist}</p>
                        </div>
                      )}
                      {result.metadata.coverArt && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">Cover Art:</span>
                          <img 
                            src={result.metadata.coverArt} 
                            alt="Cover" 
                            className="w-16 h-16 object-cover rounded mt-1"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Validation Errors */}
                {result.validationErrors && result.validationErrors.length > 0 && (
                  <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-3">Validation Warnings</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {result.validationErrors.map((error, index) => (
                        <li key={index} className="text-yellow-700">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Data Results */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    {testType === 'albums' ? 'Albums' : 'Publisher Items'} ({Array.isArray(result.data) ? result.data.length : 0})
                  </h3>
                  
                  {Array.isArray(result.data) && result.data.length > 0 ? (
                    <div className="space-y-4">
                      {testType === 'albums' ? (
                        (result.data as RSSAlbum[]).map((album, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start space-x-4">
                              {album.coverArt && (
                                <img 
                                  src={album.coverArt} 
                                  alt={album.title}
                                  className="w-16 h-16 object-cover rounded"
                                />
                              )}
                              <div className="flex-1">
                                <h4 className="font-semibold text-gray-900">{album.title}</h4>
                                <p className="text-gray-600">{album.artist}</p>
                                {album.description && (
                                  <p className="text-sm text-gray-500 mt-1">{album.description}</p>
                                )}
                                <p className="text-sm text-gray-500 mt-2">
                                  {album.tracks?.length || 0} tracks • {album.releaseDate}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        (result.data as RSSPublisherItem[]).map((item, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-4">
                            <h4 className="font-semibold text-gray-900">{item.title || `Item ${index + 1}`}</h4>
                            <p className="text-sm text-gray-600 mt-1">Feed URL: {item.feedUrl}</p>
                            <p className="text-sm text-gray-500">Medium: {item.medium}</p>
                            <p className="text-sm text-gray-500">GUID: {item.feedGuid}</p>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500">No data found in the feed.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="border border-red-200 bg-red-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
                <p className="text-red-700">{result.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 