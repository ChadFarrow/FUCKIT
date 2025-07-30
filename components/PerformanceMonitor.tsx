'use client';

import { useEffect } from 'react';

export default function PerformanceMonitor() {
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Monitor Core Web Vitals
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            console.log('LCP:', entry.startTime);
          } else if (entry.entryType === 'first-input' && 'duration' in entry) {
            // First Input Delay is represented by the duration
            console.log('FID:', entry.duration);
          } else if (entry.entryType === 'layout-shift' && 'value' in entry) {
            console.log('CLS:', (entry as any).value);
          }
        }
      });

      try {
        observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
      } catch (e) {
        // Some browsers might not support all entry types
        console.warn('Performance monitoring not fully supported:', e);
      }

      // Monitor page load time
      window.addEventListener('load', () => {
        const loadTime = performance.now();
        console.log('Page load time:', loadTime);
      });

      return () => observer.disconnect();
    }
  }, []);

  return null; // This component doesn't render anything
} 