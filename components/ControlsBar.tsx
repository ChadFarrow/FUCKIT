'use client';

import { Filter, Grid3X3, List, Shuffle } from 'lucide-react';

export type FilterType = 'all' | 'new' | 'albums' | 'eps' | 'singles' | 'publishers' | 'playlist' | 'videos' | 'podcasts';
export type ViewType = 'grid' | 'list';
export type SortType = 'name-asc' | 'name-desc' | 'year-desc' | 'year-asc' | 'tracks-desc' | 'tracks-asc' | 'added-desc' | 'added-asc';

interface ControlsBarProps {
  // Filter props
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  showFilters?: boolean;
  filterOptions?: { value: FilterType; label: string }[];
  isFilterLoading?: boolean;
  
  // Sort props
  sortType: SortType;
  onSortChange: (sort: SortType) => void;
  sortOptions?: { value: SortType; label: string }[];
  showSort?: boolean;
  
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

/** Full sort options for album/EP/single lists (Year and Added = release/feed date). */
export const SORT_OPTIONS_ALBUMS: { value: SortType; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'year-desc', label: 'Year (Newest)' },
  { value: 'year-asc', label: 'Year (Oldest)' },
  { value: 'added-desc', label: 'Added (Newest)' },
  { value: 'added-asc', label: 'Added (Oldest)' },
  { value: 'tracks-desc', label: 'Tracks (Most)' },
  { value: 'tracks-asc', label: 'Tracks (Least)' },
];

/** Reduced sort options for publisher cards (no Year/Tracks). */
export const SORT_OPTIONS_PUBLISHERS: { value: SortType; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'added-desc', label: 'Added (Newest)' },
  { value: 'added-asc', label: 'Added (Oldest)' },
];

/** Sort options for playlist cards (Name and Tracks only; no date-based sort). */
export const SORT_OPTIONS_PLAYLIST: { value: SortType; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'tracks-desc', label: 'Tracks (Most)' },
  { value: 'tracks-asc', label: 'Tracks (Least)' },
];

const defaultSortOptions = SORT_OPTIONS_ALBUMS;

// Filter options for publishers
const defaultFilters: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'albums', label: 'Albums' },
  { value: 'eps', label: 'EPs' },
  { value: 'singles', label: 'Singles' },
  { value: 'publishers', label: 'Publishers' },
  { value: 'playlist', label: 'Playlists' },
  { value: 'podcasts', label: 'Podcasts' },
  { value: 'videos', label: 'Videos' },
];

export default function ControlsBar({
  activeFilter,
  onFilterChange,
  showFilters = true,
  filterOptions = defaultFilters,
  sortType,
  onSortChange,
  sortOptions = defaultSortOptions,
  showSort = true,
  viewType,
  onViewChange,
  showViewToggle = true,
  onShuffle,
  showShuffle = false,
  className = '',
  resultCount,
  resultLabel = 'results',
  isFilterLoading = false,
}: ControlsBarProps) {
  return (
    <div className={`bg-black/70 backdrop-blur-sm rounded-xl border border-gray-700 shadow-lg ${className}`}>
      {/* Mobile Layout - Stacked */}
      <div className="block sm:hidden">
        {/* First Row - Filters */}
        {showFilters && (
          <div className="p-3 border-b border-gray-700">
            <div className="flex gap-1 overflow-x-auto pb-1">
              {filterOptions.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => onFilterChange(filter.value)}
                  disabled={isFilterLoading}
                  className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-all touch-manipulation flex-shrink-0 ${
                    activeFilter === filter.value
                      ? 'bg-stablekraft-teal text-white shadow-sm'
                      : isFilterLoading 
                        ? 'text-gray-500 bg-gray-800 cursor-not-allowed opacity-50'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700 active:bg-gray-600'
                  }`}
                >
                  {isFilterLoading && activeFilter !== filter.value ? (
                    <span className="flex items-center gap-1">
                      <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                      {filter.label}
                    </span>
                  ) : (
                    filter.label
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Second Row - Sort, Count, and Actions */}
        <div className="flex items-center justify-between p-3 gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Sort */}
            {showSort && (
              <select 
                value={sortType} 
                onChange={(e) => onSortChange(e.target.value as SortType)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-stablekraft-teal focus:border-stablekraft-teal transition-all whitespace-nowrap touch-manipulation"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-gray-800 text-white">
                    {option.label}
                  </option>
                ))}
              </select>
            )}

            {/* Result count */}
            {resultCount !== undefined && (
              <div className="text-xs text-gray-400 whitespace-nowrap">
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
                className="bg-stablekraft-teal hover:bg-stablekraft-orange text-white p-1.5 rounded-lg transition-all touch-manipulation shadow-lg hover:shadow-xl active:scale-95"
                title="Random Shuffle"
              >
                <Shuffle className="w-4 h-4" />
              </button>
            )}

            {/* View Toggle */}
            {showViewToggle && (
              <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-600">
                <button
                  onClick={() => onViewChange('grid')}
                  className={`p-1 rounded transition-all touch-manipulation ${
                    viewType === 'grid' 
                      ? 'bg-stablekraft-teal text-white shadow-sm' 
                      : 'text-gray-300 hover:text-white active:bg-gray-700'
                  }`}
                  title="Grid view"
                >
                  <Grid3X3 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onViewChange('list')}
                  className={`p-1 rounded transition-all touch-manipulation ${
                    viewType === 'list' 
                      ? 'bg-stablekraft-teal text-white shadow-sm' 
                      : 'text-gray-300 hover:text-white active:bg-gray-700'
                  }`}
                  title="List view"
                >
                  <List className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Layout - Single Row */}
      <div className="hidden sm:flex items-center gap-3 p-3 sm:p-4 overflow-x-auto">
        {/* Left side - Filters, Sort, and Result count */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Filters */}
          {showFilters && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {filterOptions.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => onFilterChange(filter.value)}
                    disabled={isFilterLoading}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all touch-manipulation ${
                      activeFilter === filter.value
                        ? 'bg-stablekraft-teal text-white shadow-sm'
                        : isFilterLoading 
                          ? 'text-gray-500 bg-gray-800 cursor-not-allowed opacity-50'
                          : 'text-gray-300 hover:text-white hover:bg-gray-700 active:bg-gray-600'
                    }`}
                  >
                    {isFilterLoading && activeFilter !== filter.value ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                        {filter.label}
                      </span>
                    ) : (
                      filter.label
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sort */}
          {showSort && (
            <select 
              value={sortType} 
              onChange={(e) => onSortChange(e.target.value as SortType)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-stablekraft-teal focus:border-stablekraft-teal transition-all whitespace-nowrap touch-manipulation"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-gray-800 text-white">
                  {option.label}
                </option>
              ))}
            </select>
          )}

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
            className="bg-stablekraft-teal hover:bg-stablekraft-orange text-white p-1.5 rounded-lg transition-all touch-manipulation shadow-lg hover:shadow-xl active:scale-95"
            title="Random Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>
        )}

        {/* View Toggle */}
        {showViewToggle && (
          <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-600">
            <button
              onClick={() => onViewChange('grid')}
              className={`p-1.5 rounded transition-all touch-manipulation ${
                viewType === 'grid' 
                  ? 'bg-stablekraft-teal text-white shadow-sm' 
                  : 'text-gray-300 hover:text-white active:bg-gray-700'
              }`}
              title="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewChange('list')}
              className={`p-1.5 rounded transition-all touch-manipulation ${
                viewType === 'list' 
                  ? 'bg-stablekraft-teal text-white shadow-sm' 
                  : 'text-gray-300 hover:text-white active:bg-gray-700'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}