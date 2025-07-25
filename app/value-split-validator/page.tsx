'use client';

import { useState } from 'react';

interface ValueTimeSplit {
  startTime: string;
  duration: string;
  remotePercentage: number;
  remoteValue: string;
  type: string;
  method: string;
  suggested?: string;
  name?: string;
  image?: string;
  customKey?: string;
  customValue?: string;
}

interface ValidationResult {
  success: boolean;
  splits: ValueTimeSplit[];
  errors: string[];
  warnings: string[];
  totalPercentage: number;
  totalDuration: string;
  metadata?: {
    title?: string;
    description?: string;
    artist?: string;
  };
  processingTime?: number;
}

// Helper function to parse value-time-splits from XML
const parseValueTimeSplitsFromXML = (xmlText: string): ValueTimeSplit[] => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    // Check for parsing errors
    const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parserError) {
      throw new Error('Invalid XML format');
    }
    
    const splits: ValueTimeSplit[] = [];
    
    // Find all podcast:valueTimeSplit elements
    const valueSplits = Array.from(xmlDoc.getElementsByTagName('podcast:valueTimeSplit'));
    
    valueSplits.forEach((split: unknown) => {
      const element = split as Element;
      
      const startTime = element.getAttribute('startTime') || '';
      const duration = element.getAttribute('duration') || '';
      const remotePercentage = parseInt(element.getAttribute('remotePercentage') || '0');
      const remoteValue = element.getAttribute('remoteValue') || '';
      const type = element.getAttribute('type') || '';
      const method = element.getAttribute('method') || '';
      const suggested = element.getAttribute('suggested') || undefined;
      const name = element.getAttribute('name') || undefined;
      const image = element.getAttribute('image') || undefined;
      const customKey = element.getAttribute('customKey') || undefined;
      const customValue = element.getAttribute('customValue') || undefined;
      
      splits.push({
        startTime,
        duration,
        remotePercentage,
        remoteValue,
        type,
        method,
        suggested,
        name,
        image,
        customKey,
        customValue
      });
    });
    
    console.log(`💰 Found ${splits.length} value-time-splits in XML`);
    return splits;
    
  } catch (error) {
    console.error('❌ Error parsing value-time-splits from XML:', error);
    throw error;
  }
};

// Helper function to extract metadata from XML
const extractMetadataFromXML = (xmlText: string): { title?: string; description?: string; artist?: string } | undefined => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parserError) {
      return undefined;
    }
    
    const channels = xmlDoc.getElementsByTagName('channel');
    if (!channels || channels.length === 0) {
      return undefined;
    }
    const channel = channels[0];
    
    const titleElement = channel.getElementsByTagName('title')[0];
    const title = titleElement?.textContent?.trim() || '';
    const descriptionElement = channel.getElementsByTagName('description')[0];
    const description = descriptionElement?.textContent?.trim() || '';
    
    let artist = title;
    const authorElements = channel.getElementsByTagName('itunes:author');
    const authorElement = authorElements.length > 0 ? authorElements[0] : channel.getElementsByTagName('author')[0];
    if (authorElement) {
      artist = authorElement.textContent?.trim() || artist;
    }
    
    return { title, description, artist };
  } catch (error) {
    console.error('❌ Error extracting metadata from XML:', error);
    return undefined;
  }
};

// Helper function to validate ISO 8601 duration format
const isValidDuration = (duration: string): boolean => {
  // Basic ISO 8601 duration pattern: PT1H30M15S, PT30M, PT15S, etc.
  const durationPattern = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;
  return durationPattern.test(duration);
};

// Helper function to validate time format (HH:MM:SS)
const isValidTime = (time: string): boolean => {
  const timePattern = /^(\d{1,2}):(\d{2}):(\d{2})$/;
  const match = time.match(timePattern);
  if (!match) return false;
  
  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const seconds = parseInt(match[3]);
  
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59;
};

// Helper function to validate Lightning address
const isValidLightningAddress = (address: string): boolean => {
  // Basic Lightning address pattern: username@domain.com
  const lightningPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return lightningPattern.test(address);
};

// Helper function to validate Bitcoin address
const isValidBitcoinAddress = (address: string): boolean => {
  // Basic Bitcoin address patterns (legacy, segwit, native segwit)
  const bitcoinPattern = /^(bc1|[13])[a-km-zA-HJ-NP-Z1-9]{25,62}$/;
  return bitcoinPattern.test(address);
};

// Main validation function
const validateValueTimeSplits = (splits: ValueTimeSplit[]): { errors: string[]; warnings: string[]; totalPercentage: number; totalDuration: string } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalPercentage = 0;
  let totalDurationSeconds = 0;
  
  if (splits.length === 0) {
    errors.push('No value-time-splits found in the feed');
    return { errors, warnings, totalPercentage, totalDuration: 'PT0S' };
  }
  
  splits.forEach((split, index) => {
    // Validate startTime
    if (!split.startTime) {
      errors.push(`Split ${index + 1}: Missing startTime`);
    } else if (!isValidTime(split.startTime)) {
      errors.push(`Split ${index + 1}: Invalid startTime format (expected HH:MM:SS): ${split.startTime}`);
    }
    
    // Validate duration
    if (!split.duration) {
      errors.push(`Split ${index + 1}: Missing duration`);
    } else if (!isValidDuration(split.duration)) {
      errors.push(`Split ${index + 1}: Invalid duration format (expected PT1H30M15S): ${split.duration}`);
    } else {
      // Parse duration to seconds for total calculation
      const durationMatch = split.duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1] || '0');
        const minutes = parseInt(durationMatch[2] || '0');
        const seconds = parseInt(durationMatch[3] || '0');
        totalDurationSeconds += hours * 3600 + minutes * 60 + seconds;
      }
    }
    
    // Validate remotePercentage
    if (split.remotePercentage < 0 || split.remotePercentage > 100) {
      errors.push(`Split ${index + 1}: remotePercentage must be between 0 and 100: ${split.remotePercentage}`);
    }
    totalPercentage += split.remotePercentage;
    
    // Validate remoteValue
    if (!split.remoteValue) {
      errors.push(`Split ${index + 1}: Missing remoteValue`);
    } else {
      // Check if it's a Lightning address or Bitcoin address
      if (split.remoteValue.includes('@')) {
        if (!isValidLightningAddress(split.remoteValue)) {
          warnings.push(`Split ${index + 1}: remoteValue may not be a valid Lightning address: ${split.remoteValue}`);
        }
      } else if (split.remoteValue.startsWith('bc1') || split.remoteValue.startsWith('1') || split.remoteValue.startsWith('3')) {
        if (!isValidBitcoinAddress(split.remoteValue)) {
          warnings.push(`Split ${index + 1}: remoteValue may not be a valid Bitcoin address: ${split.remoteValue}`);
        }
      } else {
        warnings.push(`Split ${index + 1}: remoteValue format not recognized: ${split.remoteValue}`);
      }
    }
    
    // Validate type
    if (!split.type) {
      errors.push(`Split ${index + 1}: Missing type`);
    } else if (!['lightning', 'hive', 'webmonetization'].includes(split.type)) {
      warnings.push(`Split ${index + 1}: Unknown type: ${split.type}`);
    }
    
    // Validate method
    if (!split.method) {
      errors.push(`Split ${index + 1}: Missing method`);
    } else if (!['keysend', 'lnurl-pay', 'lightning', 'hive', 'webmonetization'].includes(split.method)) {
      warnings.push(`Split ${index + 1}: Unknown method: ${split.method}`);
    }
    
    // Check for overlapping time ranges
    if (index > 0) {
      const prevSplit = splits[index - 1];
      const prevStart = prevSplit.startTime;
      const prevDuration = prevSplit.duration;
      
      // Simple overlap check (could be more sophisticated)
      if (prevStart === split.startTime) {
        warnings.push(`Split ${index + 1}: May overlap with previous split at time ${split.startTime}`);
      }
    }
  });
  
  // Check total percentage
  if (Math.abs(totalPercentage - 100) > 0.01) {
    warnings.push(`Total remotePercentage is ${totalPercentage.toFixed(2)}%, should be 100%`);
  }
  
  // Convert total duration back to ISO format
  const hours = Math.floor(totalDurationSeconds / 3600);
  const minutes = Math.floor((totalDurationSeconds % 3600) / 60);
  const seconds = totalDurationSeconds % 60;
  
  let totalDuration = 'PT';
  if (hours > 0) totalDuration += `${hours}H`;
  if (minutes > 0) totalDuration += `${minutes}M`;
  if (seconds > 0) totalDuration += `${seconds}S`;
  if (totalDuration === 'PT') totalDuration = 'PT0S';
  
  return { errors, warnings, totalPercentage, totalDuration };
};

export default function ValueSplitValidatorPage() {
  const [inputMode, setInputMode] = useState<'url' | 'xml'>('url');
  const [feedUrl, setFeedUrl] = useState('');
  const [xmlContent, setXmlContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const testFeed = async () => {
    setIsLoading(true);
    const startTime = Date.now();
    
    try {
      let splits: ValueTimeSplit[] = [];
      let metadata: { title?: string; description?: string; artist?: string; } | undefined = undefined;
      
      if (inputMode === 'url') {
        if (!feedUrl.trim()) {
          throw new Error('Please enter a feed URL');
        }
        
        console.log(`🔍 Fetching value-time-splits from: ${feedUrl}`);
        
        const response = await fetch(`/api/fetch-rss?url=${encodeURIComponent(feedUrl)}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
        }
        
        const xmlText = await response.text();
        splits = parseValueTimeSplitsFromXML(xmlText);
        metadata = extractMetadataFromXML(xmlText);
        
      } else {
        if (!xmlContent.trim()) {
          throw new Error('Please enter XML content');
        }
        
        console.log('🔍 Parsing value-time-splits from XML content');
        splits = parseValueTimeSplitsFromXML(xmlContent);
        metadata = extractMetadataFromXML(xmlContent);
      }
      
      const validation = validateValueTimeSplits(splits);
      const processingTime = Date.now() - startTime;
      
      setResult({
        success: validation.errors.length === 0,
        splits,
        errors: validation.errors,
        warnings: validation.warnings,
        totalPercentage: validation.totalPercentage,
        totalDuration: validation.totalDuration,
        metadata,
        processingTime
      });
      
    } catch (error) {
      console.error('❌ Error testing value-time-splits:', error);
      setResult({
        success: false,
        splits: [],
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        warnings: [],
        totalPercentage: 0,
        totalDuration: 'PT0S'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResult(null);
    setFeedUrl('');
    setXmlContent('');
  };

  const formatDuration = (duration: string): string => {
    const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!match) return duration;
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
    
    return parts.join(' ') || '0s';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            💰 Value-Time-Split Validator
          </h1>
          <p className="text-lg text-gray-600">
            Validate podcast:valueTimeSplit elements in RSS feeds
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex space-x-4 mb-4">
            <button
              onClick={() => setInputMode('url')}
              className={`px-4 py-2 rounded-md font-medium ${
                inputMode === 'url'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Feed URL
            </button>
            <button
              onClick={() => setInputMode('xml')}
              className={`px-4 py-2 rounded-md font-medium ${
                inputMode === 'xml'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Paste XML
            </button>
          </div>

          {inputMode === 'url' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                RSS Feed URL
              </label>
              <input
                type="url"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                placeholder="https://example.com/feed.xml"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                XML Content
              </label>
              <textarea
                value={xmlContent}
                onChange={(e) => setXmlContent(e.target.value)}
                placeholder="Paste your RSS feed XML here..."
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
          )}

          <div className="flex space-x-4 mt-4">
            <button
              onClick={testFeed}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Validating...' : 'Validate Value-Time-Splits'}
            </button>
            <button
              onClick={clearResults}
              className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Validation Results
              </h2>
              <div className="flex items-center space-x-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {result.success ? '✅ Valid' : '❌ Invalid'}
                </span>
                {result.processingTime && (
                  <span className="text-sm text-gray-500">
                    Processed in {result.processingTime}ms
                  </span>
                )}
              </div>
            </div>

            {/* Metadata */}
            {result.metadata && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Feed Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Title:</span>
                    <p className="text-gray-900">{result.metadata.title || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Artist:</span>
                    <p className="text-gray-900">{result.metadata.artist || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Description:</span>
                    <p className="text-gray-900 truncate">{result.metadata.description || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{result.splits.length}</div>
                <div className="text-sm text-blue-800">Value-Time-Splits</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{result.totalPercentage.toFixed(1)}%</div>
                <div className="text-sm text-green-800">Total Percentage</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">{formatDuration(result.totalDuration)}</div>
                <div className="text-sm text-purple-800">Total Duration</div>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-orange-600">{result.errors.length}</div>
                <div className="text-sm text-orange-800">Errors</div>
              </div>
            </div>

            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-red-800 mb-3">❌ Errors</h3>
                <div className="space-y-2">
                  {result.errors.map((error, index) => (
                    <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-red-800 text-sm">{error}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-yellow-800 mb-3">⚠️ Warnings</h3>
                <div className="space-y-2">
                  {result.warnings.map((warning, index) => (
                    <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <p className="text-yellow-800 text-sm">{warning}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Value-Time-Splits Table */}
            {result.splits.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">💰 Value-Time-Splits</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          #
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Start Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Duration
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Percentage
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Method
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Recipient
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.splits.map((split, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {split.startTime}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDuration(split.duration)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              split.remotePercentage === 100 ? 'bg-green-100 text-green-800' :
                              split.remotePercentage > 50 ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {split.remotePercentage}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              split.type === 'lightning' ? 'bg-yellow-100 text-yellow-800' :
                              split.type === 'hive' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {split.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {split.method}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="max-w-xs truncate" title={split.remoteValue}>
                              {split.remoteValue}
                            </div>
                            {split.name && (
                              <div className="text-xs text-gray-500 truncate" title={split.name}>
                                {split.name}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 