'use client';

import { useEffect, useRef, useState } from 'react';

export interface FilterOption {
  name: string;
  count: number;
}

interface FilterDropdownProps {
  label: string;                       // "Genre", "Tag"
  selected: string | null;
  options: FilterOption[];
  onSelect: (next: string | null) => void;
  clearAriaLabel?: string;             // e.g. "Clear genre filter"
  className?: string;                  // for the outer wrapper (e.g. "ml-1")
}

/**
 * Pill dropdown that slots into the top filter bar. Owns its own open state,
 * ref, and outside-click handler. Visual parity with the bare filter pills.
 */
export default function FilterDropdown({
  label,
  selected,
  options,
  onSelect,
  clearAriaLabel,
  className = '',
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  if (options.length === 0) return null;

  const pillClasses = `px-3 py-2 rounded text-sm font-medium whitespace-nowrap transition-all ${
    selected ? 'bg-stablekraft-teal text-white shadow-sm' : 'text-gray-300 hover:text-white hover:bg-gray-700'
  }`;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={pillClasses}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {selected ? `${label}: ${selected}` : `${label} ▾`}
        {selected && (
          <span
            role="button"
            aria-label={clearAriaLabel ?? `Clear ${label.toLowerCase()} filter`}
            className="ml-2 text-white/80 hover:text-white"
            onClick={(e) => { e.stopPropagation(); onSelect(null); setIsOpen(false); }}
          >×</span>
        )}
      </button>
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-40 mt-2 w-64 max-h-80 overflow-y-auto rounded-lg bg-zinc-900 border border-white/10 shadow-xl"
        >
          {options.map((opt) => (
            <button
              key={opt.name}
              type="button"
              role="option"
              aria-selected={selected === opt.name}
              onClick={() => {
                const next = opt.name === selected ? null : opt.name;
                onSelect(next);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-white/10 ${
                selected === opt.name ? 'bg-white/5 text-white' : 'text-white/80'
              }`}
            >
              <span className="truncate">{opt.name}</span>
              <span className="ml-2 text-xs text-white/50">{opt.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
