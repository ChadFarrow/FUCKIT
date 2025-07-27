'use client';

import { useState } from 'react';
import { AppError, ErrorCodes } from '@/lib/error-utils';
import { toast } from '@/components/Toast';
import { RSSParser } from '@/lib/rss-parser';

export default function ErrorTestPage() {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (test: string, status: 'success' | 'error', message: string, details?: any) => {
    setTestResults(prev => [...prev, {
      test,
      status,
      message,
      details,
      timestamp: new Date().toISOString()
    }]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  // Test scenarios
  const testToastNotifications = async () => {
    addResult('Toast Notifications', 'success', 'Testing all toast types...');
    
    toast.success('This is a success message');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.error('This is an error message');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.warning('This is a warning message');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.info('This is an info message');
    
    addResult('Toast Notifications', 'success', 'All toast types displayed');
  };

  const testRSSFeedErrors = async () => {
    const testFeeds = [
      { url: 'https://invalid-domain-12345.com/feed.xml', expectedError: 'Network error' },
      { url: 'https://httpbin.org/html', expectedError: 'Invalid XML format' },
      { url: 'https://httpbin.org/status/429', expectedError: 'Rate limited' },
      { url: 'https://httpbin.org/status/500', expectedError: 'Server error' }
    ];

    for (const testFeed of testFeeds) {
      try {
        addResult('RSS Feed Error', 'success', `Testing: ${testFeed.url}`);
        
        const result = await RSSParser.parseAlbumFeed(testFeed.url);
        
        if (result === null) {
          addResult('RSS Feed Error', 'success', `Correctly handled error for ${testFeed.expectedError}`);
        } else {
          addResult('RSS Feed Error', 'error', `Unexpected success for ${testFeed.url}`, result);
        }
      } catch (error) {
        const errorMessage = error instanceof AppError ? error.message : String(error);
        addResult('RSS Feed Error', 'success', `Correctly caught error: ${errorMessage}`);
      }
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  };

  const testErrorBoundary = () => {
    // This will be caught by the error boundary
    throw new Error('Test error boundary - this should be caught and display fallback UI');
  };

  const testAudioErrors = () => {
    addResult('Audio Error', 'success', 'Testing audio error scenarios...');
    
    // Create test audio element with invalid source
    const audio = new Audio('https://invalid-audio-url.mp3');
    
    audio.addEventListener('error', (e) => {
      const target = e.target as HTMLAudioElement;
      const error = target.error;
      
      let errorType = 'Unknown';
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            errorType = 'Network Error';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorType = 'Decode Error';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorType = 'Format Not Supported';
            break;
        }
      }
      
      addResult('Audio Error', 'success', `Audio error correctly detected: ${errorType}`);
      toast.error(`Audio error: ${errorType}`);
    });
    
    // Trigger the error
    audio.load();
  };

  const testNetworkTimeout = async () => {
    addResult('Network Timeout', 'success', 'Testing network timeout...');
    
    try {
      // This should timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      await fetch('https://httpbin.org/delay/10', {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      addResult('Network Timeout', 'error', 'Request should have timed out');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        addResult('Network Timeout', 'success', 'Timeout correctly handled');
        toast.error('Request timed out');
      } else {
        addResult('Network Timeout', 'error', `Unexpected error: ${error}`);
      }
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    clearResults();
    
    try {
      addResult('Test Suite', 'success', 'Starting comprehensive error handling tests...');
      
      await testToastNotifications();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await testRSSFeedErrors();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      testAudioErrors();
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await testNetworkTimeout();
      
      addResult('Test Suite', 'success', 'All tests completed successfully!');
      toast.success('Error handling tests completed!');
      
    } catch (error) {
      addResult('Test Suite', 'error', `Test suite failed: ${error}`);
      toast.error('Test suite encountered an error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Error Handling Test Suite</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={runAllTests}
            disabled={isRunning}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            {isRunning ? 'Running Tests...' : 'Run All Tests'}
          </button>
          
          <button
            onClick={clearResults}
            className="bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Clear Results
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button
            onClick={testToastNotifications}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-medium transition-colors"
          >
            Test Toasts
          </button>
          
          <button
            onClick={testAudioErrors}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded font-medium transition-colors"
          >
            Test Audio Errors
          </button>
          
          <button
            onClick={testErrorBoundary}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-medium transition-colors"
          >
            Test Error Boundary
          </button>
        </div>

        <div className="bg-gray-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          
          {testResults.length === 0 ? (
            <p className="text-gray-400">No tests run yet. Click &quot;Run All Tests&quot; to begin.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded border-l-4 ${
                    result.status === 'success'
                      ? 'bg-green-900/20 border-green-500'
                      : 'bg-red-900/20 border-red-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{result.test}</p>
                      <p className="text-sm text-gray-300">{result.message}</p>
                      {result.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-400 cursor-pointer">Details</summary>
                          <pre className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-300 mb-2">Test Instructions</h3>
          <ul className="text-sm text-yellow-100 space-y-1">
            <li>• <strong>Run All Tests:</strong> Executes comprehensive error handling tests</li>
            <li>• <strong>Test Toasts:</strong> Displays all toast notification types</li>
            <li>• <strong>Test Audio Errors:</strong> Simulates audio playback failures</li>
            <li>• <strong>Test Error Boundary:</strong> Triggers React error boundary (will show error page)</li>
            <li>• Watch for toast notifications appearing in the bottom-right corner</li>
            <li>• Check browser console for detailed error logs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}