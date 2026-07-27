/**
 * Monitoring and logging utilities to prevent recurring issues
 *
 * Error and warning entries are reported to /api/client-log so they reach Railway.
 * Before that existed this class was write-only in production: it buffered into an
 * in-memory array in the user's browser and console-logged only in development, so
 * every call site — including the playback-failure warning in AudioContext — was
 * collecting diagnostics nobody could ever read. Info entries stay local.
 */

import { ClientLogBuffer } from './client-log';

const FLUSH_DELAY_MS = 5_000;

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: any;
}

class MonitoringService {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 1000;
  private errorPatterns: Map<string, number> = new Map();
  private reportBuffer = new ClientLogBuffer();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private unloadHooked = false;

  /**
   * Log an event with structured data
   */
  log(level: 'info' | 'warn' | 'error', category: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data
    };

    this.logs.unshift(entry);
    
    // Keep only recent logs
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(0, this.MAX_LOGS);
    }

    // Track error patterns
    if (level === 'error') {
      const pattern = `${category}:${message}`;
      this.errorPatterns.set(pattern, (this.errorPatterns.get(pattern) || 0) + 1);
    }

    // Console output in development
    if (process.env.NODE_ENV === 'development') {
      const emoji = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
      console.log(`${emoji} [${category}] ${message}`, data ? data : '');
    }

    if (level !== 'info') {
      this.queueReport(level, category, message, data);
    }
  }

  /**
   * Buffers an error/warning for /api/client-log. Every failure mode here is
   * swallowed — reporting a problem must never become a second problem.
   */
  private queueReport(level: 'warn' | 'error', category: string, message: string, data?: any) {
    if (typeof window === 'undefined') return;

    try {
      const shouldFlush = this.reportBuffer.add({ level, category, message, data }, Date.now());

      this.hookUnload();

      if (shouldFlush && this.flushTimer === null) {
        // Batched rather than sent per-entry: failures arrive in bursts, and one
        // request per retry attempt would be its own kind of flood.
        this.flushTimer = setTimeout(() => {
          this.flushTimer = null;
          this.flushReports();
        }, FLUSH_DELAY_MS);
      }
    } catch {
      // Ignore.
    }
  }

  /**
   * A backgrounded tab may never come back — on iOS it is frequently killed outright
   * — so pending reports are flushed on the way out via sendBeacon, which survives
   * unload where fetch does not. 'pagehide' rather than 'unload': the latter is not
   * fired reliably on mobile Safari and disqualifies the page from the bfcache.
   */
  private hookUnload() {
    if (this.unloadHooked) return;
    this.unloadHooked = true;

    const flushOnExit = () => this.flushReports(true);
    window.addEventListener('pagehide', flushOnExit);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushOnExit();
    });
  }

  private flushReports(isUnloading = false) {
    try {
      const { entries, dropped } = this.reportBuffer.drain();
      if (entries.length === 0 && dropped === 0) return;

      const payload = JSON.stringify({
        entries,
        dropped,
        context: {
          path: window.location?.pathname,
          platform: navigator.userAgent,
          display: window.matchMedia?.('(display-mode: standalone)')?.matches ? 'standalone' : 'browser',
        },
      });

      if (isUnloading && navigator.sendBeacon) {
        navigator.sendBeacon('/api/client-log', new Blob([payload], { type: 'application/json' }));
        return;
      }

      // keepalive so a flush already in flight survives a navigation.
      fetch('/api/client-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Ignore.
    }
  }

  /**
   * Log info level
   */
  info(category: string, message: string, data?: any) {
    this.log('info', category, message, data);
  }

  /**
   * Log warning level
   */
  warn(category: string, message: string, data?: any) {
    this.log('warn', category, message, data);
  }

  /**
   * Log error level
   */
  error(category: string, message: string, data?: any) {
    this.log('error', category, message, data);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit: number = 100): LogEntry[] {
    return this.logs.slice(0, limit);
  }

  /**
   * Get logs by category
   */
  getLogsByCategory(category: string, limit: number = 100): LogEntry[] {
    return this.logs.filter(log => log.category === category).slice(0, limit);
  }

  /**
   * Get error patterns that might indicate recurring issues
   */
  getRecurringErrorPatterns(): Array<{ pattern: string; count: number }> {
    return Array.from(this.errorPatterns.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .filter(({ count }) => count > 2) // Only show patterns that occurred more than twice
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get monitoring summary
   */
  getSummary(): {
    totalLogs: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    recurringErrors: number;
    categories: string[];
  } {
    const errorCount = this.logs.filter(log => log.level === 'error').length;
    const warningCount = this.logs.filter(log => log.level === 'warn').length;
    const infoCount = this.logs.filter(log => log.level === 'info').length;
    const categories = Array.from(new Set(this.logs.map(log => log.category)));
    const recurringErrors = this.getRecurringErrorPatterns().length;

    return {
      totalLogs: this.logs.length,
      errorCount,
      warningCount,
      infoCount,
      recurringErrors,
      categories
    };
  }

  /**
   * Clear old logs
   */
  clearOldLogs() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.logs = this.logs.filter(log => new Date(log.timestamp).getTime() > oneHourAgo);
    
    // Reset error patterns older than 1 hour
    this.errorPatterns.clear();
  }
}

// Singleton instance
export const monitoring = new MonitoringService();

/**
 * Decorator for monitoring function calls
 */
export function monitoredFunction(category: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;
        
        monitoring.info(category, `${propertyKey} completed`, { duration, args: args.length });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        monitoring.error(category, `${propertyKey} failed`, { 
          duration, 
          error: (error as Error).message,
          args: args.length 
        });
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Monitor API responses for common issues
 */
export function monitorApiResponse(url: string, response: Response, data?: any) {
  const category = 'api-response';
  
  if (!response.ok) {
    monitoring.error(category, `API ${response.status} error`, {
      url,
      status: response.status,
      statusText: response.statusText
    });
  } else if (response.status === 200) {
    // Check for common data issues
    if (data && typeof data === 'object') {
      if (Array.isArray(data.feeds) && data.feeds.length === 0) {
        monitoring.warn(category, 'API returned empty feeds array', { url });
      }
      
      if (Array.isArray(data.albums) && data.albums.length === 0) {
        monitoring.warn(category, 'API returned empty albums array', { url });
      }
      
      if (data.validation && data.validation.warningsCount > 10) {
        monitoring.warn(category, `High validation warning count: ${data.validation.warningsCount}`, { url });
      }
    }
    
    monitoring.info(category, `API request successful`, { url, status: response.status });
  }
}

/**
 * Monitor component lifecycle for debugging
 */
export function monitorComponent(componentName: string, phase: 'mount' | 'update' | 'unmount', data?: any) {
  monitoring.info('component-lifecycle', `${componentName} ${phase}`, data);
}

export default monitoring;