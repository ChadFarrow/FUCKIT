'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamic import for the heavy ControlsBar component
const ControlsBar = dynamic(() => import('./ControlsBar'), {
  loading: () => (
    <div className="mb-8 p-4 bg-gray-800/20 rounded-lg animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-8 bg-gray-700/50 rounded w-24"></div>
        <div className="h-8 bg-gray-700/50 rounded w-20"></div>
        <div className="h-8 bg-gray-700/50 rounded w-16"></div>
        <div className="h-8 bg-gray-700/50 rounded w-20"></div>
      </div>
    </div>
  ),
  ssr: true // Controls can be server-side rendered
});

// Re-export the types from the original component
export type { FilterType, ViewType, SortType } from './ControlsBar';

interface ControlsBarLazyProps {
  activeFilter: any;
  onFilterChange: (filter: any) => void;
  sortType: any;
  onSortChange: (sort: any) => void;
  viewType: any;
  onViewChange: (view: any) => void;
  showShuffle?: boolean;
  onShuffle?: () => void;
  resultCount: number;
  resultLabel: string;
  className?: string;
}

export default function ControlsBarLazy(props: ControlsBarLazyProps) {
  return (
    <Suspense fallback={
      <div className="mb-8 p-4 bg-gray-800/20 rounded-lg animate-pulse">
        <div className="flex items-center gap-4">
          <div className="h-8 bg-gray-700/50 rounded w-24"></div>
          <div className="h-8 bg-gray-700/50 rounded w-20"></div>
          <div className="h-8 bg-gray-700/50 rounded w-16"></div>
          <div className="h-8 bg-gray-700/50 rounded w-20"></div>
        </div>
      </div>
    }>
      <ControlsBar {...props} />
    </Suspense>
  );
} 