export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogContext {
  component?: string;
  function?: string;
  userId?: string;
  sessionId?: string;
  context?: string;
  [key: string]: any; // Allow additional properties
}

class Logger {
  private level: LogLevel;
  private context: LogContext = {};

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
    
    // Set level based on environment
    if (process.env.NODE_ENV === 'development') {
      this.level = LogLevel.DEBUG;
    }
  }

  setContext(context: Partial<LogContext>) {
    this.context = { ...this.context, ...context };
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const ctx = { ...this.context, ...context };
    const contextStr = Object.keys(ctx).length > 0 
      ? ` [${Object.entries(ctx).map(([k, v]) => `${k}=${v}`).join(', ')}]`
      : '';
    
    return `[${timestamp}] [${level}]${contextStr} ${message}`;
  }

  debug(message: string, ...args: any[]) {
    if (this.level <= LogLevel.DEBUG) {
      console.log(this.formatMessage('DEBUG', message), ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.log(this.formatMessage('INFO', message), ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
  }

  error(message: string, error?: any, context?: LogContext) {
    if (this.level <= LogLevel.ERROR) {
      const errorInfo = error instanceof Error 
        ? { name: error.name, message: error.message, stack: error.stack }
        : error;
      
      console.error(this.formatMessage('ERROR', message, context), errorInfo);
    }
  }

  // Performance logging
  time(label: string) {
    if (this.level <= LogLevel.DEBUG) {
      console.time(`[PERF] ${label}`);
    }
  }

  timeEnd(label: string) {
    if (this.level <= LogLevel.DEBUG) {
      console.timeEnd(`[PERF] ${label}`);
    }
  }

  // Component-specific logging
  component(componentName: string) {
    return {
      debug: (message: string, ...args: any[]) => 
        this.debug(message, ...args, { component: componentName }),
      info: (message: string, ...args: any[]) => 
        this.info(message, ...args, { component: componentName }),
      warn: (message: string, ...args: any[]) => 
        this.warn(message, ...args, { component: componentName }),
      error: (message: string, error?: any) => 
        this.error(message, error, { component: componentName }),
    };
  }

  // Function-specific logging
  function(functionName: string) {
    return {
      debug: (message: string, ...args: any[]) => 
        this.debug(message, ...args, { function: functionName }),
      info: (message: string, ...args: any[]) => 
        this.info(message, ...args, { function: functionName }),
      warn: (message: string, ...args: any[]) => 
        this.warn(message, ...args, { function: functionName }),
      error: (message: string, error?: any) => 
        this.error(message, error, { function: functionName }),
    };
  }
}

// Create singleton instance
export const logger = new Logger();

// Convenience functions for common patterns
export const log = {
  debug: (message: string, ...args: any[]) => logger.debug(message, ...args),
  info: (message: string, ...args: any[]) => logger.info(message, ...args),
  warn: (message: string, ...args: any[]) => logger.warn(message, ...args),
  error: (message: string, error?: any) => logger.error(message, error),
  time: (label: string) => logger.time(label),
  timeEnd: (label: string) => logger.timeEnd(label),
  component: (name: string) => logger.component(name),
  function: (name: string) => logger.function(name),
};

// Legacy compatibility
export const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('DEV:', ...args);
  }
};

export const verboseLog = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('VERBOSE:', ...args);
  }
}; 