'use client';

import { useEffect, useState } from 'react';
import type { FilterOption } from './FilterDropdown';

interface UseFilterDropdownOpts {
  fetchUrl: string;                       // e.g. '/api/genres'
  responseKey: string;                    // key inside response holding the array (e.g. 'genres', 'tags')
  initial: string | null;                 // URL-param seed on mount
  delayMs?: number;                       // lazy-fetch delay so main grid loads first
}

interface UseFilterDropdownReturn {
  selected: string | null;
  setSelected: (v: string | null) => void;
  options: FilterOption[];
}

/**
 * Owns selected-state + lazy-fetched options for a filter dropdown.
 * Intentionally does NOT know about mutual exclusion — the parent wires
 * that across multiple hook instances where both setters are visible.
 */
export function useFilterDropdown({
  fetchUrl,
  responseKey,
  initial,
  delayMs = 600,
}: UseFilterDropdownOpts): UseFilterDropdownReturn {
  const [selected, setSelected] = useState<string | null>(initial);
  const [options, setOptions] = useState<FilterOption[]>([]);

  useEffect(() => {
    if (options.length > 0) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(fetchUrl);
        if (!res.ok) return;
        const data = await res.json();
        const items = data?.[responseKey];
        if (Array.isArray(items)) setOptions(items);
      } catch { /* silent — dropdown just stays hidden */ }
    }, delayMs);
    return () => clearTimeout(t);
    // Intentional: fetch is one-shot; deps tie to options length only to skip re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  return { selected, setSelected, options };
}
