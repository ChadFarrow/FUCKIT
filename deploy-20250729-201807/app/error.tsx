'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global error caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-900 rounded-lg shadow-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <AlertCircle className="h-16 w-16 text-red-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">
          Oops! Something went wrong
        </h1>
        
        <p className="text-gray-400 mb-6">
          We encountered an unexpected error. Don&apos;t worry, your data is safe.
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="text-left mb-6">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-400">
              Error details (development only)
            </summary>
            <pre className="mt-2 p-3 bg-gray-800 rounded text-xs text-gray-300 overflow-auto">
              {error.toString()}
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
} 