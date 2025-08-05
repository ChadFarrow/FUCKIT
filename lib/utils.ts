/**
 * Format seconds into MM:SS format
 */
export const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0 || seconds > 86400) return '0:00'; // Max 24 hours
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

/**
 * Safely format any value, replacing NaN with a fallback
 */
export const safeFormat = (value: any, fallback: string = 'Unknown'): string => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  
  const stringValue = String(value);
  if (stringValue === 'NaN' || stringValue === 'undefined' || stringValue === 'null') {
    return fallback;
  }
  
  return stringValue;
};

/**
 * Safely format a number, replacing NaN with a fallback
 */
export const safeFormatNumber = (value: number, fallback: number = 0): number => {
  if (isNaN(value) || !isFinite(value)) {
    return fallback;
  }
  return value;
};

/**
 * Format a date to a readable string
 */
export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Truncate text to a specified length
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}; 