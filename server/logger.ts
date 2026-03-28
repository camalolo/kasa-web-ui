type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function ts(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function format(level: LogLevel, ctx: string, msg: string, data?: unknown): string {
  const base = `${ts()} [${level.toUpperCase().padEnd(5)}] [${ctx}] ${msg}`;
  if (data !== undefined) {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return `${base} ${str}`;
  }
  return base;
}

export interface Logger {
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, err?: unknown): void;
}

export function createLogger(ctx: string): Logger {
  return {
    debug(msg: string, data?: unknown) {
      if (shouldLog('debug')) console.debug(format('debug', ctx, msg, data));
    },
    info(msg: string, data?: unknown) {
      if (shouldLog('info')) console.log(format('info', ctx, msg, data));
    },
    warn(msg: string, data?: unknown) {
      if (shouldLog('warn')) console.warn(format('warn', ctx, msg, data));
    },
    error(msg: string, err?: unknown) {
      if (shouldLog('error')) {
        if (err instanceof Error) {
          console.error(format('error', ctx, `${msg}: ${err.message}`, err.stack));
        } else {
          console.error(format('error', ctx, msg, err));
        }
      }
    },
  };
}
