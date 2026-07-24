'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowUp } from 'lucide-react';

/**
 * Floating back-to-top button
 * Appears when user scrolls down, smoothly scrolls to top when clicked
 */
export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();
  // Album and podcast pages put a kebab on every track row in exactly this corner,
  // so the floating button covers one row's controls. Those pages also carry a
  // compact sticky header, which already provides orientation while scrolling.
  const overlapsRowControls = !!pathname && (pathname.startsWith('/album/') || pathname.startsWith('/podcast/'));

  useEffect(() => {
    const toggleVisibility = () => {
      // Show button when page is scrolled down 300px
      setIsVisible(window.scrollY > 300);
    };

    // Throttle scroll event for performance
    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(toggleVisibility, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Check initial scroll position
    toggleVisibility();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible || overlapsRowControls) {
    return null;
  }

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-24 right-6 z-40 p-3 bg-stablekraft-teal hover:bg-stablekraft-orange text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 active:scale-95 group"
      aria-label="Back to top"
      title="Back to top"
    >
      <ArrowUp className="w-5 h-5 group-hover:transform group-hover:-translate-y-0.5 transition-transform" />
    </button>
  );
}
