import { logger } from './logger';

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
  
  // Image errors
  IMAGE_LOAD_ERROR: 'IMAGE_LOAD_ERROR',
  IMAGE_TIMEOUT_ERROR: 'IMAGE_TIMEOUT_ERROR',
  IMAGE_CORS_ERROR: 'IMAGE_CORS_ERROR',
  
  // General errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export class AppError extends Error {
  constructor(
    public message: string,
    public code: ErrorCode = 'UNKNOWN_ERROR' as ErrorCode,
    public statusCode: number = 500,
    public isOperational: boolean = true,
    public details?: any,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

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
  
  // Image errors
  IMAGE_LOAD_ERROR: 'Failed to load image. Please try again.',
  IMAGE_TIMEOUT_ERROR: 'Image loading timed out. Please try again.',
  IMAGE_CORS_ERROR: 'Image loading blocked by browser security.',
  
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
    if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
      return ErrorMessages.IMAGE_CORS_ERROR;
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
      ErrorCodes.IMAGE_LOAD_ERROR,
      ErrorCodes.IMAGE_TIMEOUT_ERROR,
    ];
    return retryableCodes.includes(error.code);
  }
  
  if (error instanceof Error) {
    const retryablePatterns = [
      'network',
      'timeout',
      'fetch',
      '429',
      'rate limit',
      'temporary',
      'retry',
    ];
    return retryablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern)
    );
  }
  
  return false;
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
      
      logger.error(`[${context}] ${message}`, error, { context });
      
      // Here you could send to error tracking service
      // sendToErrorTracking(errorInfo);
    },
    
    warn: (message: string, details?: any) => {
      const timestamp = new Date().toISOString();
      logger.warn(`[${context}] ${message}`, { timestamp, details });
    },
    
    info: (message: string, details?: any) => {
      const timestamp = new Date().toISOString();
      logger.info(`[${context}] ${message}`, { timestamp, details });
    },
  };
}

// Enhanced retry function with better logging
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    backoff?: number;
    onRetry?: (attempt: number, error: unknown) => void;
    context?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = 2,
    onRetry,
    context = 'withRetry'
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        logger.error(`[${context}] Final retry attempt failed`, error, { 
          context, 
          attempt, 
          maxRetries 
        });
        throw error;
      }

      if (!isRetryableError(error)) {
        logger.warn(`[${context}] Non-retryable error, not retrying`, { 
          context, 
          attempt, 
          error: error instanceof Error ? error.message : error 
        });
        throw error;
      }

      const waitTime = delay * Math.pow(backoff, attempt - 1);
      
      logger.warn(`[${context}] Attempt ${attempt} failed, retrying in ${waitTime}ms`, {
        context,
        attempt,
        maxRetries,
        waitTime,
        error: error instanceof Error ? error.message : error
      });

      if (onRetry) {
        onRetry(attempt, error);
      }

      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}

// Error handler wrapper for async functions
export function errorHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string,
  options?: {
    logError?: boolean;
    rethrow?: boolean;
    fallback?: () => R;
  }
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const { logError = true, rethrow = true, fallback } = options || {};
      
      if (logError) {
        logger.error(`Error in ${context}`, error, { context });
      }
      
      if (fallback) {
        try {
          return fallback();
        } catch (fallbackError) {
          logger.error(`Fallback also failed in ${context}`, fallbackError, { context });
          if (rethrow) throw fallbackError;
        }
      }
      
      if (rethrow) throw error;
      
      // Return undefined if not rethrowing and no fallback
      return undefined as R;
    }
  };
}

// API error handler for Next.js API routes
export function handleApiError(error: unknown, context?: string): Response {
  const errorContext = context || 'API';
  
  if (error instanceof AppError) {
    logger.error(`[${errorContext}] AppError occurred`, error, { 
      context: errorContext,
      code: error.code,
      statusCode: error.statusCode 
    });
    
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        code: error.code,
        details: error.details 
      }), 
      { 
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  if (error instanceof Error) {
    logger.error(`[${errorContext}] Error occurred`, error, { context: errorContext });
    
    return new Response(
      JSON.stringify({ 
        error: getErrorMessage(error),
        code: 'UNKNOWN_ERROR'
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  logger.error(`[${errorContext}] Unknown error occurred`, error, { context: errorContext });
  
  return new Response(
    JSON.stringify({ 
      error: ErrorMessages.UNKNOWN_ERROR,
      code: 'UNKNOWN_ERROR'
    }), 
    { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// Validation error creator
export function createValidationError(message: string, field?: string, value?: any): AppError {
  return new AppError(
    message,
    'VALIDATION_ERROR',
    400,
    true,
    { field, value },
    { validation: true }
  );
}

// Network error creator
export function createNetworkError(message: string, url?: string): AppError {
  return new AppError(
    message,
    'NETWORK_ERROR',
    503,
    true,
    { url },
    { network: true }
  );
}

// Timeout error creator
export function createTimeoutError(message: string, timeout?: number): AppError {
  return new AppError(
    message,
    'TIMEOUT_ERROR',
    408,
    true,
    { timeout },
    { timeout: true }
  );
}