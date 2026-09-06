/**
 * Application-wide constants
 * Centralized location for magic numbers and configuration values
 */

// Pagination
export const ITEMS_PER_PAGE = 50;
export const INITIAL_VISIBLE_ITEMS = 12;

// Cache durations (in milliseconds)
export const CACHE_DURATION = {
  SHORT: 5 * 60 * 1000, // 5 minutes
  MEDIUM: 15 * 60 * 1000, // 15 minutes
  LONG: 60 * 60 * 1000, // 1 hour
  DAY: 24 * 60 * 60 * 1000, // 1 day
} as const;

// Scroll thresholds
export const SCROLL_THRESHOLDS = {
  BACK_TO_TOP: 300, // Show back-to-top button after scrolling 300px
  INFINITE_SCROLL: 100, // Trigger load more 100px before end
  MIN_SWIPE_DISTANCE: 50, // Minimum swipe distance for gestures
  MIN_SCROLL_DISTANCE: 10, // Minimum scroll to detect scroll intent
} as const;

// Media breakpoints (matching Tailwind)
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const;

// Audio/Track classifications
export const TRACK_COUNT_THRESHOLDS = {
  SINGLE: 1,
  EP_MIN: 2,
  EP_MAX: 5,
  ALBUM_MIN: 6,
} as const;

// API versioning
export const API_VERSION = 'v10';

// Filter types
export const FILTER_TYPES = ['all', 'albums', 'eps', 'singles', 'publishers', 'playlist', 'videos'] as const;
export type FilterType = typeof FILTER_TYPES[number];

// View types
export const VIEW_TYPES = ['grid', 'list'] as const;
export type ViewType = typeof VIEW_TYPES[number];

// Sort types
export const SORT_TYPES = ['name', 'date', 'artist'] as const;
export type SortType = typeof SORT_TYPES[number];

// Image sizes
export const IMAGE_SIZES = {
  THUMBNAIL: 80,
  SMALL: 200,
  MEDIUM: 400,
  LARGE: 800,
} as const;

// Toast durations
export const TOAST_DURATION = {
  SHORT: 2000,
  MEDIUM: 3000,
  LONG: 5000,
} as const;

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  PLAY_PAUSE: ' ', // Space
  NEXT_TRACK: 'ArrowRight',
  PREVIOUS_TRACK: 'ArrowLeft',
  FOCUS_SEARCH: '/',
  CLOSE_MODAL: 'Escape',
} as const;

/**
 * The app's name as it appears on other people's wires — the NIP-89 `client`
 * tag on a boost note, the Helipad `app_name` TLV artists read, the
 * nostrconnect:// handshake a signer shows.
 *
 * Deliberately NOT `SITE_CONFIG.name` ('Project StableKraft'), which is the
 * display and SEO title and is free to be reworded. Rewording that must never
 * silently rename this app in someone else's boost index.
 */
export const APP_NAME = 'StableKraft';

// Site metadata
export const SITE_CONFIG = {
  name: 'Project StableKraft',
  description: 'Discover and listen to music and podcasts from the Doerfel family and friends',
  url: process.env.NEXT_PUBLIC_BASE_URL || 'https://stablekraft.app',
  twitterHandle: '@stablekraft',
} as const;
