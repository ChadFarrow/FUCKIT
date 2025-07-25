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
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 ${className}`}>
      {/* Left side - Filters and result count */}
      <div className="flex items-center gap-4">
        {/* Filters */}
        {showFilters && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1">
              {defaultFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => onFilterChange(filter.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeFilter === filter.value
                      ? 'bg-white/20 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Result count */}
        {resultCount !== undefined && (
          <div className="text-sm text-gray-400">
            {resultCount} {resultLabel}
          </div>
        )}
      </div>

      {/* Right side - Sort and View Controls */}
      <div className="flex items-center gap-4">
        {/* Sort */}
        <select 
          value={sortType} 
          onChange={(e) => onSortChange(e.target.value as SortType)}
          className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value} className="bg-gray-800 text-white">
              {option.label}
            </option>
          ))}
        </select>

        {/* View Toggle */}
        {showViewToggle && (
          <div className="flex items-center bg-white/10 rounded-lg p-1">
            <button
              onClick={() => onViewChange('grid')}
              className={`p-1.5 rounded transition-all ${
                viewType === 'grid' 
                  ? 'bg-white/20 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewChange('list')}
              className={`p-1.5 rounded transition-all ${
                viewType === 'list' 
                  ? 'bg-white/20 text-white' 
                  : 'text-gray-400 hover:text-white'
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