import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { handleApiError, AppError, createValidationError } from './error-utils';

export interface ApiHandlerOptions<T = any> {
  validate?: (req: NextRequest) => boolean | Promise<boolean>;
  transform?: (data: T) => any;
  logRequest?: boolean;
  logResponse?: boolean;
  context?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: any;
}

// Create standardized API handler
export function createApiHandler<T>(
  handler: (req: NextRequest) => Promise<T>,
  options: ApiHandlerOptions<T> = {}
) {
  const {
    validate,
    transform,
    logRequest = true,
    logResponse = true,
    context = 'API'
  } = options;

  return async (req: NextRequest) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    try {
      // Log request
      if (logRequest) {
        logger.info(`[${context}] API Request started`, {
          context,
          requestId,
          method: req.method,
          url: req.url,
          headers: Object.fromEntries(req.headers.entries())
        });
      }

      // Validate request
      if (validate) {
        const isValid = await validate(req);
        if (!isValid) {
          throw createValidationError('Invalid request', 'request', {
            method: req.method,
            url: req.url
          });
        }
      }

      // Execute handler
      const result = await handler(req);
      
      // Transform response
      const transformed = transform ? transform(result) : result;
      
      // Create response
      const response: ApiResponse<T> = {
        success: true,
        data: transformed
      };

      // Log response
      if (logResponse) {
        const duration = Date.now() - startTime;
        logger.info(`[${context}] API Request completed`, {
          context,
          requestId,
          duration: `${duration}ms`,
          status: 200
        });
      }

      return NextResponse.json(response, { status: 200 });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`[${context}] API Request failed`, error, {
        context,
        requestId,
        duration: `${duration}ms`,
        method: req.method,
        url: req.url
      });

      return handleApiError(error, context);
    }
  };
}

// Common validation functions
export const validators = {
  requireMethod: (method: string) => (req: NextRequest) => {
    return req.method === method;
  },
  
  requireQueryParam: (param: string) => (req: NextRequest) => {
    const url = new URL(req.url);
    return url.searchParams.has(param);
  },
  
  requireBody: () => async (req: NextRequest) => {
    try {
      const body = await req.json();
      return body && typeof body === 'object';
    } catch {
      return false;
    }
  },
  
  requireAuth: () => (req: NextRequest) => {
    // Add your authentication logic here
    const authHeader = req.headers.get('authorization');
    return !!authHeader;
  }
};

// Common response transformers
export const transformers = {
  paginate: <T>(data: T[], page: number, limit: number) => {
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = data.slice(start, end);
    
    return {
      data: paginatedData,
      pagination: {
        page,
        limit,
        total: data.length,
        totalPages: Math.ceil(data.length / limit),
        hasNext: end < data.length,
        hasPrev: page > 1
      }
    };
  },
  
  sort: <T>(data: T[], sortBy: keyof T, order: 'asc' | 'desc' = 'asc') => {
    return [...data].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (order === 'desc') {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
      
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    });
  },
  
  filter: <T>(data: T[], predicate: (item: T) => boolean) => {
    return data.filter(predicate);
  }
};

// Rate limiting lives in lib/rate-limit.ts, with the route-side guard in
// lib/rate-limit-guard.ts. A second RateLimiter class used to sit here: it had
// no callers, it never swept its Map, and having two classes of the same name
// meant an import could silently pick the wrong one. Deleted for the same
// reason as the CORS helper below.
//
// CORS lives in lib/cors.ts. The helper that used to sit here was unimported
// and wrong — it joined origins with ', ', which is not a valid
// Access-Control-Allow-Origin value and which every browser rejects.

// Cache utility
export class ApiCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  set(key: string, data: any, ttl: number = 5 * 60 * 1000) { // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  get(key: string): any | null {
    const record = this.cache.get(key);
    if (!record) return null;
    
    if (Date.now() - record.timestamp > record.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return record.data;
  }
  
  delete(key: string) {
    this.cache.delete(key);
  }
  
  clear() {
    this.cache.clear();
  }
}

// Request parsing utilities
export const requestUtils = {
  getQueryParam: (req: NextRequest, param: string): string | null => {
    const url = new URL(req.url);
    return url.searchParams.get(param);
  },
  
  getQueryParams: (req: NextRequest): Record<string, string> => {
    const url = new URL(req.url);
    return Object.fromEntries(url.searchParams.entries());
  },
  
  getBody: async <T = any>(req: NextRequest): Promise<T> => {
    try {
      return await req.json();
    } catch {
      throw createValidationError('Invalid JSON body');
    }
  },
  
  getHeaders: (req: NextRequest): Record<string, string> => {
    return Object.fromEntries(req.headers.entries());
  }
};

// Response utilities
export const responseUtils = {
  success: <T>(data: T, status: number = 200) => {
    return NextResponse.json({ success: true, data }, { status });
  },
  
  error: (message: string, status: number = 400, code?: string) => {
    return NextResponse.json({ 
      success: false, 
      error: message, 
      code 
    }, { status });
  },
  
  notFound: (message: string = 'Resource not found') => {
    return responseUtils.error(message, 404, 'NOT_FOUND');
  },
  
  unauthorized: (message: string = 'Unauthorized') => {
    return responseUtils.error(message, 401, 'UNAUTHORIZED');
  },
  
  forbidden: (message: string = 'Forbidden') => {
    return responseUtils.error(message, 403, 'FORBIDDEN');
  },
  
  serverError: (message: string = 'Internal server error') => {
    return responseUtils.error(message, 500, 'SERVER_ERROR');
  }
}; 