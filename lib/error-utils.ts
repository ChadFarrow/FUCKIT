export class AppError extends Error {
  constructor(
    public message: string,
    public code: string = 'UNKNOWN_ERROR',
    public statusCode: number = 500,
    public isOperational: boolean = true,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const ErrorCodes = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  
  // RSS errors
  RSS_PARSE_ERROR: 'RSS_PARSE_ERROR',
  RSS_FETCH_ERROR: 'RSS_FETCH_ERROR',
  RSS_INVALID_FORMAT: 'RSS_INVALID_FORMAT',
  
  // Audio errors
  AUDIO_PLAYBACK_ERROR: 'AUDIO_PLAYBACK_ERROR',
  AUDIO_LOAD_ERROR: 'AUDIO_LOAD_ERROR',
  AUDIO_NOT_FOUND: 'AUDIO_NOT_FOUND',
  
  // Album errors
  ALBUM_NOT_FOUND: 'ALBUM_NOT_FOUND',
  ALBUM_LOAD_ERROR: 'ALBUM_LOAD_ERROR',
  
  // General errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export const ErrorMessages: Record<ErrorCode, string> = {
  // Network errors
  NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  RATE_LIMIT_ERROR: 'Too many requests. Please wait a moment and try again.',
  
  // RSS errors
  RSS_PARSE_ERROR: 'Failed to parse RSS feed. The feed may be invalid.',
  RSS_FETCH_ERROR: 'Failed to fetch RSS feed. Please try again later.',
  RSS_INVALID_FORMAT: 'Invalid RSS format. Please check the feed URL.',
  
  // Audio errors
  AUDIO_PLAYBACK_ERROR: 'Audio playback failed. Please try another track.',
  AUDIO_LOAD_ERROR: 'Failed to load audio. Please check your connection.',
  AUDIO_NOT_FOUND: 'Audio file not found.',
  
  // Album errors
  ALBUM_NOT_FOUND: 'Album not found.',
  ALBUM_LOAD_ERROR: 'Failed to load album. Please try again.',
  
  // General errors
  VALIDATION_ERROR: 'Invalid input. Please check your data.',
  PERMISSION_ERROR: 'Permission denied.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('fetch')) {
      return ErrorMessages.NETWORK_ERROR;
    }
    if (error.message.includes('timeout')) {
      return ErrorMessages.TIMEOUT_ERROR;
    }
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return ErrorMessages.RATE_LIMIT_ERROR;
    }
    
    return error.message;
  }
  
  return ErrorMessages.UNKNOWN_ERROR;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    const retryableCodes: ErrorCode[] = [
      ErrorCodes.NETWORK_ERROR,
      ErrorCodes.TIMEOUT_ERROR,
      ErrorCodes.RATE_LIMIT_ERROR,
      ErrorCodes.RSS_FETCH_ERROR,
      ErrorCodes.AUDIO_LOAD_ERROR,
    ];
    return retryableCodes.includes(error.code);
  }
  
  if (error instanceof Error) {
    const retryablePatterns = [
      'fetch',
      'network',
      'timeout',
      '429',
      'rate limit',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
    ];
    
    return retryablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }
  
  return false;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    backoff?: number;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    onRetry,
  } = options;
  
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }
      
      const waitTime = delay * Math.pow(backoff, attempt);
      onRetry?.(attempt + 1, error);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
}

export function createErrorLogger(context: string) {
  return {
    error: (message: string, error?: unknown, details?: any) => {
      const timestamp = new Date().toISOString();
      const errorInfo = {
        timestamp,
        context,
        message,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        } : error,
        details,
      };
      
      console.error(`[${context}] ${message}`, errorInfo);
      
      // Here you could send to error tracking service
      // sendToErrorTracking(errorInfo);
    },
    
    warn: (message: string, details?: any) => {
      const timestamp = new Date().toISOString();
      console.warn(`[${context}] ${message}`, { timestamp, details });
    },
    
    info: (message: string, details?: any) => {
      const timestamp = new Date().toISOString();
      console.info(`[${context}] ${message}`, { timestamp, details });
    },
  };
}