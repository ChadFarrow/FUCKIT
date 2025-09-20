'use client';

import { useEffect, useState } from 'react';

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<{
    loadTime: number;
    domContentLoaded: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const measurePerformance = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');
      
      const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      const lcp = performance.getEntriesByType('largest-contentful-paint')[0];

      setMetrics({
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstContentfulPaint: fcp ? fcp.startTime : 0,
        largestContentfulPaint: lcp ? lcp.startTime : 0,
      });

      // Log performance metrics
      console.log('🚀 Performance Metrics:', {
        loadTime: `${Math.round(navigation.loadEventEnd - navigation.loadEventStart)}ms`,
        domContentLoaded: `${Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart)}ms`,
        firstContentfulPaint: fcp ? `${Math.round(fcp.startTime)}ms` : 'N/A',
        largestContentfulPaint: lcp ? `${Math.round(lcp.startTime)}ms` : 'N/A',
      });
    };

    // Wait for all performance entries to be available
    if (performance.getEntriesByType('navigation').length > 0) {
      measurePerformance();
    } else {
      window.addEventListener('load', measurePerformance);
    }

    return () => {
      window.removeEventListener('load', measurePerformance);
    };
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== 'development' || !metrics) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-2 rounded text-xs font-mono z-50">
      <div>Load: {Math.round(metrics.loadTime)}ms</div>
      <div>DOM: {Math.round(metrics.domContentLoaded)}ms</div>
      <div>FCP: {Math.round(metrics.firstContentfulPaint)}ms</div>
      <div>LCP: {Math.round(metrics.largestContentfulPaint)}ms</div>
    </div>
  );
}