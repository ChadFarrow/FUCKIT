'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for debugging in dev
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h2 className="text-2xl font-semibold">Something went wrong</h2>
        <p className="text-gray-400">{error?.message || 'An unexpected error occurred.'}</p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded bg-white/10 hover:bg-white/20"
          >Try again</button>
        </div>
      </div>
    </div>
  );
}

 