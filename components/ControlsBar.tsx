'use client';

import { Filter, Grid3X3, List, Shuffle } from 'lucide-react';

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
  
  // Shuffle prop
  onShuffle?: () => void;
  showShuffle?: boolean;
  
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
  onShuffle,
  showShuffle = false,
  className = '',
  resultCount,
  resultLabel = 'results',
}: ControlsBarProps) {
  return (
    <div className={`flex items-center gap-3 p-3 sm:p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-x-auto ${className}`}>
      {/* Left side - Filters, Sort, and Result count */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Filters */}
        {showFilters && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400 hidden sm:block flex-shrink-0" />
            <div className="flex gap-1">
              {defaultFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => onFilterChange(filter.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all touch-manipulation ${
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
        )}

        {/* Sort */}
        <select 
          value={sortType} 
          onChange={(e) => onSortChange(e.target.value as SortType)}
          className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all whitespace-nowrap touch-manipulation"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value} className="bg-gray-900 text-white">
              {option.label}
            </option>
          ))}
        </select>

        {/* Result count */}
        {resultCount !== undefined && (
          <div className="text-sm text-gray-400 whitespace-nowrap">
            <span className="font-medium text-white">{resultCount}</span> {resultLabel}
          </div>
        )}
      </div>

      {/* Right side - Action buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Shuffle Button */}
        {showShuffle && onShuffle && (
          <button
            onClick={onShuffle}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white p-1.5 rounded-lg transition-all touch-manipulation shadow-lg hover:shadow-xl active:scale-95"
            title="Random Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>
        )}

        {/* View Toggle */}
        {showViewToggle && (
          <div className="flex items-center bg-white/10 rounded-lg p-1 border border-white/10">
            <button
              onClick={() => onViewChange('grid')}
              className={`p-1.5 rounded transition-all touch-manipulation ${
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
              className={`p-1.5 rounded transition-all touch-manipulation ${
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