// Structured logging service

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: Error;
}

interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  context?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: import.meta.env.DEV ? 'debug' : 'warn',
  enableConsole: true,
  enableRemote: import.meta.env.PROD,
};

class Logger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 10;
  private readonly FLUSH_INTERVAL = 5000;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  private formatMessage(entry: LogEntry): string {
    const prefix = entry.context ? `[${entry.context}]` : '';
    return `${entry.timestamp} ${entry.level.toUpperCase()} ${prefix} ${entry.message}`;
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: this.config.context,
      data,
      error,
    };

    // Console output
    if (this.config.enableConsole) {
      const formattedMessage = this.formatMessage(entry);
      const consoleData = data ? { ...data, error } : error ? { error } : undefined;

      switch (level) {
        case 'debug':
          console.debug(formattedMessage, consoleData || '');
          break;
        case 'info':
          console.info(formattedMessage, consoleData || '');
          break;
        case 'warn':
          console.warn(formattedMessage, consoleData || '');
          break;
        case 'error':
          console.error(formattedMessage, consoleData || '');
          break;
      }
    }

    // Buffer for remote logging
    if (this.config.enableRemote && level !== 'debug') {
      this.buffer.push(entry);
      this.scheduleFlush();
    }
  }

  private scheduleFlush() {
    if (this.buffer.length >= this.BUFFER_SIZE) {
      this.flush();
      return;
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, this.FLUSH_INTERVAL);
    }
  }

  private async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    // In production, this would send to a logging service
    // For now, we'll just store in sessionStorage for debugging
    try {
      const existingLogs = JSON.parse(sessionStorage.getItem('app_logs') || '[]');
      const allLogs = [...existingLogs, ...entries].slice(-100); // Keep last 100
      sessionStorage.setItem('app_logs', JSON.stringify(allLogs));
    } catch (e) {
      // Silently fail
    }
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>) {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>) {
    this.log('error', message, data, error);
  }

  /**
   * Create a child logger with a specific context
   */
  child(context: string): Logger {
    return new Logger({
      ...this.config,
      context: this.config.context ? `${this.config.context}:${context}` : context,
    });
  }

  /**
   * Time a function execution
   */
  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.debug(`${label} completed`, { duration: `${duration.toFixed(2)}ms` });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.error(`${label} failed`, error as Error, { duration: `${duration.toFixed(2)}ms` });
      throw error;
    }
  }

  /**
   * Get stored logs (for debugging)
   */
  getLogs(): LogEntry[] {
    try {
      return JSON.parse(sessionStorage.getItem('app_logs') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Clear stored logs
   */
  clearLogs() {
    sessionStorage.removeItem('app_logs');
    this.buffer = [];
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for creating contextual loggers
export { Logger };

// Named loggers for common areas
export const authLogger = logger.child('auth');
export const apiLogger = logger.child('api');
export const uiLogger = logger.child('ui');
export const performanceLogger = logger.child('perf');

export default logger;
