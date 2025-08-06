'use client';

import { useScrollDetection } from '@/hooks/useScrollDetection';
import { createContext, useContext, ReactNode } from 'react';

interface ScrollDetectionContextType {
  isScrolling: boolean;
  shouldPreventClick: () => boolean;
}

const ScrollDetectionContext = createContext<ScrollDetectionContextType>({
  isScrolling: false,
  shouldPreventClick: () => false
});

export const useScrollDetectionContext = () => useContext(ScrollDetectionContext);

interface ScrollDetectionProviderProps {
  children: ReactNode;
}

export default function ScrollDetectionProvider({ children }: ScrollDetectionProviderProps) {
  const { 
    isScrolling, 
    handleTouchStart, 
    handleTouchMove, 
    handleTouchEnd, 
    shouldPreventClick 
  } = useScrollDetection();

  return (
    <ScrollDetectionContext.Provider value={{ isScrolling, shouldPreventClick }}>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ height: '100%', width: '100%' }}
      >
        {children}
      </div>
    </ScrollDetectionContext.Provider>
  );
}