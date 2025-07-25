'use client';

import { Filter, Grid3X3, List } from 'lucide-react';

export type FilterType = 'all' | 'albums' | 'eps' | 'singles';
export type ViewType = 'grid' | 'list';
export type SortType = 'name' | 'year' | 'tracks';

interface ControlsBarProps {
  // Filter props
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  showFilters?: boolean;
  
  // Sort props
  sortType: SortType;
  onSortChange: (sort: SortType) => void;
  sortOptions?: { value: SortType; label: string }[];
  
  // View props
  viewType: ViewType;
  onViewChange: (view: ViewType) => void;
  showViewToggle?: boolean;
  
  // Customization
  className?: string;
  resultCount?: number;
  resultLabel?: string;
}

const defaultSortOptions: { value: SortType; label: string }[] = [
  { value: 'name', label: 'Sort by Name' },
  { value: 'year', label: 'Sort by Year' },
  { value: 'tracks', label: 'Sort by Tracks' },
];

const defaultFilters: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'albums', label: 'Albums' },
  { value: 'eps', label: 'EPs' },
  { value: 'singles', label: 'Singles' },
];

export default function ControlsBar({
  activeFilter,
  onFilterChange,
  showFilters = true,
  sortType,
  onSortChange,
  sortOptions = defaultSortOptions,
  viewType,
  onViewChange,
  showViewToggle = true,
  className = '',
  resultCount,
  resultLabel = 'results',
}: ControlsBarProps) {
  return (
    <div className={`flex flex-col gap-3 p-3 sm:p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 ${className}`}>
      {/* Top row - Filters */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Filter className="w-4 h-4 text-gray-400 hidden sm:block" />
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              {defaultFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => onFilterChange(filter.value)}
                  className={`px-4 py-2 sm:px-3 sm:py-1.5 rounded-lg text-sm sm:text-sm font-medium whitespace-nowrap transition-all touch-manipulation ${
                    activeFilter === filter.value
                      ? 'bg-white/20 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white hover:bg-white/10 active:bg-white/15'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Result count - mobile position */}
          {resultCount !== undefined && (
            <div className="text-sm text-gray-400 ml-auto sm:ml-0">
              <span className="font-medium text-white">{resultCount}</span> {resultLabel}
            </div>
          )}
        </div>
      )}

      {/* Bottom row - Sort and View Controls */}
      <div className="flex items-center justify-between gap-3">
        {/* Sort */}
        <select 
          value={sortType} 
          onChange={(e) => onSortChange(e.target.value as SortType)}
          className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 sm:py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all min-w-0 flex-1 sm:flex-initial touch-manipulation"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value} className="bg-gray-900 text-white">
              {option.label}
            </option>
          ))}
        </select>

        {/* View Toggle */}
        {showViewToggle && (
          <div className="flex items-center bg-white/10 rounded-lg p-1 border border-white/10">
            <button
              onClick={() => onViewChange('grid')}
              className={`p-2 sm:p-1.5 rounded transition-all touch-manipulation ${
                viewType === 'grid' 
                  ? 'bg-white/20 text-white shadow-sm' 
                  : 'text-gray-400 hover:text-white active:bg-white/10'
              }`}
              title="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewChange('list')}
              className={`p-2 sm:p-1.5 rounded transition-all touch-manipulation ${
                viewType === 'list' 
                  ? 'bg-white/20 text-white shadow-sm' 
                  : 'text-gray-400 hover:text-white active:bg-white/10'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}