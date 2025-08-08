'use client';

import { useState } from 'react';

interface ValidationResult {
  tag: string;
  category: string;
  status: 'pass' | 'fail' | 'warning' | 'not-found';
  message: string;
  value?: string;
  count?: number;
}

interface ValidationReport {
  success: boolean;
  results: ValidationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    notFound: number;
  };
  processingTime: number;
  feedUrl?: string;
}

interface TagCategory {
  name: string;
  description: string;
  tags: Array<{
    name: string;
    description: string;
    required?: boolean;
    namespace?: string;
  }>;
}

const TAG_CATEGORIES: TagCategory[] = [
  {
    name: 'Core RSS',
    description: 'Essential RSS 2.0 feed elements',
    tags: [
      { name: 'title', description: 'Feed title', required: true },
      { name: 'description', description: 'Feed description', required: true },
      { name: 'link', description: 'Feed link URL', required: true },
      { name: 'language', description: 'Feed language code' },
      { name: 'pubDate', description: 'Publication date' },
      { name: 'lastBuildDate', description: 'Last build date' },
      { name: 'generator', description: 'Feed generator' },
      { name: 'ttl', description: 'Time to live' },
      { name: 'image', description: 'Feed image' },
      { name: 'item', description: 'Feed items', required: true }
    ]
  },
  {
    name: 'iTunes',
    description: 'iTunes podcast namespace elements',
    tags: [
      { name: 'itunes:author', description: 'Podcast author' },
      { name: 'itunes:summary', description: 'Podcast summary' },
      { name: 'itunes:explicit', description: 'Explicit content flag' },
      { name: 'itunes:image', description: 'iTunes cover art' },
      { name: 'itunes:category', description: 'iTunes category' },
      { name: 'itunes:owner', description: 'Podcast owner' },
      { name: 'itunes:name', description: 'Owner name' },
      { name: 'itunes:email', description: 'Owner email' },
      { name: 'itunes:type', description: 'Podcast type' },
      { name: 'itunes:block', description: 'iTunes block flag' },
      { name: 'itunes:complete', description: 'Series complete flag' },
      { name: 'itunes:new-feed-url', description: 'New feed URL' }
    ]
  },
  {
    name: 'Podcast Index',
    description: 'Podcast Index namespace elements',
    tags: [
      { name: 'podcast:remoteItem', description: 'Remote item references' },
      { name: 'podcast:funding', description: 'Funding information' },
      { name: 'podcast:chapters', description: 'Chapter markers' },
      { name: 'podcast:transcript', description: 'Transcript information' },
      { name: 'podcast:license', description: 'License information' },
      { name: 'podcast:guid', description: 'Podcast GUID' },
      { name: 'podcast:medium', description: 'Content medium type' },
      { name: 'podcast:episode', description: 'Episode type' },
      { name: 'podcast:season', description: 'Season number' },
      { name: 'podcast:episode', description: 'Episode number' },
      { name: 'podcast:alternateEnclosure', description: 'Alternate enclosures' },
      { name: 'podcast:socialInteract', description: 'Social interactions' },
      { name: 'podcast:value', description: 'Value for value' },
      { name: 'podcast:person', description: 'Person information' },
      { name: 'podcast:location', description: 'Location information' },
      { name: 'podcast:soundbite', description: 'Soundbite clips' },
      { name: 'podcast:trailer', description: 'Trailer information' },
      { name: 'podcast:liveItem', description: 'Live item information' },
      { name: 'podcast:updateFrequency', description: 'Update frequency' },
      { name: 'podcast:locked', description: 'Feed lock status' },
      { name: 'podcast:payment', description: 'Payment information' }
    ]
  },
  {
    name: 'Item Elements',
    description: 'Individual item/entry elements',
    tags: [
      { name: 'item/title', description: 'Item title' },
      { name: 'item/description', description: 'Item description' },
      { name: 'item/link', description: 'Item link' },
      { name: 'item/guid', description: 'Item GUID' },
      { name: 'item/pubDate', description: 'Item publication date' },
      { name: 'item/enclosure', description: 'Item media enclosure' },
      { name: 'item/itunes:duration', description: 'iTunes duration' },
      { name: 'item/itunes:explicit', description: 'iTunes explicit flag' },
      { name: 'item/itunes:image', description: 'iTunes item image' },
      { name: 'item/itunes:episodeType', description: 'iTunes episode type' },
      { name: 'item/itunes:season', description: 'iTunes season' },
      { name: 'item/itunes:episode', description: 'iTunes episode' },
      { name: 'item/podcast:guid', description: 'Podcast Index GUID' },
      { name: 'item/podcast:medium', description: 'Podcast Index medium' },
      { name: 'item/podcast:episode', description: 'Podcast Index episode type' }
    ]
  },
  {
    name: 'Custom/Extensions',
    description: 'Custom namespace and extension elements',
    tags: [
      { name: 'atom:link', description: 'Atom link element' },
      { name: 'content:encoded', description: 'Content encoded' },
      { name: 'dc:creator', description: 'Dublin Core creator' },
      { name: 'dc:date', description: 'Dublin Core date' },
      { name: 'dc:language', description: 'Dublin Core language' },
      { name: 'dc:rights', description: 'Dublin Core rights' },
      { name: 'dc:subject', description: 'Dublin Core subject' },
      { name: 'sy:updatePeriod', description: 'Syndication update period' },
      { name: 'sy:updateFrequency', description: 'Syndication update frequency' },
      { name: 'sy:updateBase', description: 'Syndication update base' }
    ]
  }
];

export default function FeedValidatorPage() {
  const [feedUrl, setFeedUrl] = useState('');
  const [feedXml, setFeedXml] = useState('');
  const [inputMode, setInputMode] = useState<'url' | 'xml'>('url');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [selectAll, setSelectAll] = useState(false);

  // Helper function to validate a specific tag in XML
  const validateTag = (xmlDoc: Document, tagName: string, category: string): ValidationResult => {
    try {
      const [namespace, localName] = tagName.includes(':') ? tagName.split(':') : [null, tagName];
      
      let elements: NodeListOf<Element> | HTMLCollectionOf<Element>;
      if (namespace) {
        // Handle namespaced elements
        const namespaceURI = getNamespaceURI(namespace);
        if (namespaceURI) {
          elements = xmlDoc.getElementsByTagNameNS(namespaceURI, localName);
        } else {
          // Fallback to regular getElementsByTagName for unknown namespaces
          elements = xmlDoc.getElementsByTagName(tagName);
        }
      } else {
        elements = xmlDoc.getElementsByTagName(tagName);
      }
      const elementList = Array.from(elements);

      if (elementList.length === 0) {
        return {
          tag: tagName,
          category,
          status: 'not-found',
          message: `Tag '${tagName}' not found in feed`,
          count: 0
        };
      }

      // Check if it's a required tag
      const isRequired = TAG_CATEGORIES
        .flatMap(cat => cat.tags)
        .find(tag => tag.name === tagName)?.required;

      if (isRequired && elementList.length === 0) {
        return {
          tag: tagName,
          category,
          status: 'fail',
          message: `Required tag '${tagName}' is missing`,
          count: 0
        };
      }

      // Validate content
      const firstElement = elementList[0];
      const content = firstElement.textContent?.trim();
      
      if (isRequired && (!content || content.length === 0)) {
        return {
          tag: tagName,
          category,
          status: 'fail',
          message: `Required tag '${tagName}' has no content`,
          value: content || '',
          count: elementList.length
        };
      }

      // Check for common validation issues
      let status: 'pass' | 'warning' = 'pass';
      let message = `Tag '${tagName}' found with ${elementList.length} occurrence(s)`;

      if (tagName === 'language' && content) {
        const langRegex = /^[a-z]{2}(-[A-Z]{2})?$/;
        if (!langRegex.test(content)) {
          status = 'warning';
          message = `Language code '${content}' may not be in standard format`;
        }
      }

      if (tagName === 'link' && content) {
        try {
          new URL(content);
        } catch {
          status = 'warning';
          message = `Link '${content}' may not be a valid URL`;
        }
      }

      if (tagName === 'pubDate' && content) {
        const date = new Date(content);
        if (isNaN(date.getTime())) {
          status = 'warning';
          message = `Publication date '${content}' may not be in valid format`;
        }
      }

      return {
        tag: tagName,
        category,
        status,
        message,
        value: content,
        count: elementList.length
      };

    } catch (error) {
      return {
        tag: tagName,
        category,
        status: 'fail',
        message: `Error validating tag '${tagName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        count: 0
      };
    }
  };

  // Helper function to get namespace URI
  const getNamespaceURI = (prefix: string): string | null => {
    const namespaces: Record<string, string> = {
      'itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd',
      'podcast': 'https://podcastindex.org/namespace/1.0',
      'atom': 'http://www.w3.org/2005/Atom',
      'content': 'http://purl.org/rss/1.0/modules/content/',
      'dc': 'http://purl.org/dc/elements/1.1/',
      'sy': 'http://purl.org/rss/1.0/modules/syndication/'
    };
    return namespaces[prefix] || null;
  };

  const validateFeed = async () => {
    if (inputMode === 'url' && !feedUrl.trim()) {
      setReport({
        success: false,
        results: [],
        summary: { total: 0, passed: 0, failed: 0, warnings: 0, notFound: 0 },
        processingTime: 0,
        feedUrl: feedUrl
      });
      return;
    }
    if (inputMode === 'xml' && !feedXml.trim()) {
      setReport({
        success: false,
        results: [],
        summary: { total: 0, passed: 0, failed: 0, warnings: 0, notFound: 0 },
        processingTime: 0
      });
      return;
    }
    if (selectedTags.size === 0) {
      setReport({
        success: false,
        results: [],
        summary: { total: 0, passed: 0, failed: 0, warnings: 0, notFound: 0 },
        processingTime: 0
      });
      return;
    }

    setIsLoading(true);
    setReport(null);

    const startTime = Date.now();

    try {
      let xmlText: string;

      if (inputMode === 'url') {
        // Fetch XML from URL
        const response = await fetch(feedUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
        }
        xmlText = await response.text();
      } else {
        xmlText = feedXml;
      }

      // Parse XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      // Check for parsing errors
      const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
      if (parserError) {
        throw new Error('Invalid XML format');
      }

      // Validate selected tags
      const results: ValidationResult[] = [];
      const tagNames = Array.from(selectedTags);
      
      for (const tagName of tagNames) {
        const category = TAG_CATEGORIES.find(cat => 
          cat.tags.some(tag => tag.name === tagName)
        )?.name || 'Other';
        
        const result = validateTag(xmlDoc, tagName, category);
        results.push(result);
      }

      const processingTime = Date.now() - startTime;

      // Calculate summary
      const summary = {
        total: results.length,
        passed: results.filter(r => r.status === 'pass').length,
        failed: results.filter(r => r.status === 'fail').length,
        warnings: results.filter(r => r.status === 'warning').length,
        notFound: results.filter(r => r.status === 'not-found').length
      };

      setReport({
        success: true,
        results,
        summary,
        processingTime,
        feedUrl: inputMode === 'url' ? feedUrl : undefined
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      setReport({
        success: false,
        results: [],
        summary: { total: 0, passed: 0, failed: 0, warnings: 0, notFound: 0 },
        processingTime,
        feedUrl: inputMode === 'url' ? feedUrl : undefined
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTag = (tagName: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(tagName)) {
      newSelected.delete(tagName);
    } else {
      newSelected.add(tagName);
    }
    setSelectedTags(newSelected);
  };

  const toggleCategory = (category: TagCategory) => {
    const categoryTags = category.tags.map(tag => tag.name);
    const newSelected = new Set(selectedTags);
    
    const allSelected = categoryTags.every(tag => newSelected.has(tag));
    
    if (allSelected) {
      // Remove all tags from this category
      categoryTags.forEach(tag => newSelected.delete(tag));
    } else {
      // Add all tags from this category
      categoryTags.forEach(tag => newSelected.add(tag));
    }
    
    setSelectedTags(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedTags(new Set());
      setSelectAll(false);
    } else {
      const allTags = TAG_CATEGORIES.flatMap(cat => cat.tags.map(tag => tag.name));
      setSelectedTags(new Set(allTags));
      setSelectAll(true);
    }
  };

  const clearResults = () => {
    setReport(null);
    setFeedUrl('');
    setFeedXml('');
    setSelectedTags(new Set());
    setSelectAll(false);
  };

  const exportReport = () => {
    if (!report) return;
    
    const reportText = `RSS Feed Validation Report
Generated: ${new Date().toISOString()}
Feed URL: ${report.feedUrl || 'XML Input'}

Summary:
- Total Tags Checked: ${report.summary.total}
- Passed: ${report.summary.passed}
- Failed: ${report.summary.failed}
- Warnings: ${report.summary.warnings}
- Not Found: ${report.summary.notFound}

Detailed Results:
${report.results.map(result => 
  `[${result.status.toUpperCase()}] ${result.tag} (${result.category}): ${result.message}`
).join('\n')}
`;

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rss-validation-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Selective RSS Feed Validator
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Choose specific RSS tags and elements to validate in your feed. Get detailed reports on what&apos;s working and what needs attention.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Input and Tag Selection */}
          <div className="lg:col-span-1 space-y-6">
            {/* Input Form */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Feed Input</h2>
              
              {/* Input Mode Toggle */}
              <div className="mb-4">
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
                      value="xml"
                      checked={inputMode === 'xml'}
                      onChange={() => setInputMode('xml')}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Paste XML</span>
                  </label>
                </div>
              </div>

              {/* URL or XML Input */}
              {inputMode === 'url' ? (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RSS Feed URL
                  </label>
                  <input
                    type="url"
                    value={feedUrl}
                    onChange={(e) => setFeedUrl(e.target.value)}
                    placeholder="https://example.com/feed.xml"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoading}
                  />
                </div>
              ) : (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paste RSS XML
                  </label>
                  <textarea
                    value={feedXml}
                    onChange={(e) => setFeedXml(e.target.value)}
                    placeholder="Paste your RSS XML here..."
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
                    disabled={isLoading}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <button
                  onClick={validateFeed}
                  disabled={isLoading || selectedTags.size === 0 || (inputMode === 'url' ? !feedUrl.trim() : !feedXml.trim())}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Validating...
                    </span>
                  ) : (
                    'Validate Selected Tags'
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

            {/* Tag Selection */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Select Tags to Validate</h2>
                <button
                  onClick={toggleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {selectAll ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              
              <div className="text-sm text-gray-600 mb-4">
                Selected: {selectedTags.size} tags
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {TAG_CATEGORIES.map((category) => (
                  <div key={category.name} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{category.name}</h3>
                      <button
                        onClick={() => toggleCategory(category)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Toggle All
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{category.description}</p>
                    <div className="space-y-1">
                      {category.tags.map((tag) => (
                        <label key={tag.name} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={selectedTags.has(tag.name)}
                            onChange={() => toggleTag(tag.name)}
                            className="mr-2"
                          />
                          <span className="text-xs text-gray-700">
                            {tag.name}
                            {tag.required && <span className="text-red-500 ml-1">*</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2">
            {report && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Validation Results</h2>
                  <div className="flex items-center space-x-4">
                    {report.processingTime && (
                      <span className="text-sm text-gray-500">
                        Processed in {report.processingTime}ms
                      </span>
                    )}
                    <button
                      onClick={exportReport}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      Export Report
                    </button>
                  </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{report.summary.total}</div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{report.summary.passed}</div>
                    <div className="text-sm text-green-600">Passed</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{report.summary.failed}</div>
                    <div className="text-sm text-red-600">Failed</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{report.summary.warnings}</div>
                    <div className="text-sm text-yellow-600">Warnings</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">{report.summary.notFound}</div>
                    <div className="text-sm text-gray-600">Not Found</div>
                  </div>
                </div>

                {/* Detailed Results */}
                <div className="space-y-3">
                  {report.results.map((result, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        result.status === 'pass' ? 'bg-green-50 border-green-200' :
                        result.status === 'fail' ? 'bg-red-50 border-red-200' :
                        result.status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              result.status === 'pass' ? 'bg-green-100 text-green-800' :
                              result.status === 'fail' ? 'bg-red-100 text-red-800' :
                              result.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {result.status.toUpperCase()}
                            </span>
                            <span className="font-mono text-sm font-medium text-gray-900">
                              {result.tag}
                            </span>
                            <span className="text-xs text-gray-500">({result.category})</span>
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{result.message}</p>
                          {result.value && (
                            <p className="text-xs text-gray-500 mt-1 font-mono bg-gray-100 p-1 rounded">
                              Value: {result.value}
                            </p>
                          )}
                          {result.count !== undefined && (
                            <p className="text-xs text-gray-500 mt-1">
                              Count: {result.count}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 