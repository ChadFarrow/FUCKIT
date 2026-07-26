'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowUp } from 'lucide-react';
import { isAlbumDetailRoute } from '@/lib/album-detail-routes';

/**
 * Floating back-to-top button
 * Appears when user scrolls down, smoothly scrolls to top when clicked
 */
export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();
  // Album and podcast pages put a kebab on every track row in exactly this corner,
  // so the floating button covers one row's controls.
  const overlapsRowControls = isAlbumDetailRoute(pathname);

  // Pages that manage their own height (favorites' `h-[calc(100dvh-…)]` column)
  // scroll an inner element, not the window — `window.scrollY` stays 0 there, so this
  // button would never appear and clicking it would do nothing. Those pages opt in by
  // marking their scroll port with `data-scroll-container`.
  const [scroller, setScroller] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Re-query per route: the container unmounts when navigating away.
    let target: HTMLElement | Window = window;
    let timeoutId: NodeJS.Timeout;
    let observer: MutationObserver | null = null;

    const readTop = () => (target === window ? window.scrollY : (target as HTMLElement).scrollTop);
    const toggleVisibility = () => {
      // Show button when scrolled down 300px
      setIsVisible(readTop() > 300);
    };

    // Throttle scroll event for performance
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(toggleVisibility, 100);
    };

    const bind = (el: HTMLElement | null) => {
      target.removeEventListener('scroll', handleScroll);
      target = el ?? window;
      setScroller(el);
      target.addEventListener('scroll', handleScroll, { passive: true });
      toggleVisibility();
    };

    const found = document.querySelector<HTMLElement>('[data-scroll-container]');
    bind(found);

    if (!found) {
      // This component is mounted in the root layout, so on a page that renders its
      // own scroll port we run BEFORE that port exists — querying once would silently
      // leave us bound to a window that never scrolls, and the button would never
      // appear. Watch for it, then rebind.
      observer = new MutationObserver(() => {
        const el = document.querySelector<HTMLElement>('[data-scroll-container]');
        if (el) {
          bind(el);
          observer?.disconnect();
          observer = null;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      target.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [pathname]);

  const scrollToTop = () => {
    const target: HTMLElement | Window = scroller ?? window;
    target.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isVisible || overlapsRowControls) {
    return null;
  }

  // The bottom offset must clear GlobalNowPlayingBar, which is fixed at bottom 0 with
  // z-50 and is taller than it looks: 16px padding + a 56px artwork row + 16px + the
  // home-indicator inset, so ~88px plus `--sk-safe-bottom`. `bottom-24` (96px) left the
  // button's lower third behind the bar on a notched iPhone. Offsetting by the inset
  // clears it both there and on a 0-inset desktop. Per the safe-area rule, always the
  // `--sk-safe-*` var — never bare `env(safe-area-inset-*)`.
  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-[calc(var(--sk-safe-bottom)+6.5rem)] right-6 z-40 p-3 bg-stablekraft-teal hover:bg-stablekraft-orange text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 active:scale-95 group"
      aria-label="Back to top"
      title="Back to top"
    >
      <ArrowUp className="w-5 h-5 group-hover:transform group-hover:-translate-y-0.5 transition-transform" />
    </button>
  );
}
