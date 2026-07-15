import { Injectable, Logger } from '@nestjs/common';

export class ContextLogger {
  constructor(
    private readonly nestLogger: Logger,
    private readonly context: string,
  ) {}

  action(message: string, meta?: Record<string, unknown>): void {
    this.nestLogger.log(
      meta ? `${message} ${JSON.stringify(meta)}` : message,
      this.context,
    );
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.nestLogger.warn(
      meta ? `${message} ${JSON.stringify(meta)}` : message,
      this.context,
    );
  }

  fail(
    message: string,
    error?: unknown,
    meta?: Record<string, unknown>,
  ): void {
    const detail =
      error instanceof Error ? error.stack ?? error.message : String(error);
    this.nestLogger.error(
      meta
        ? `${message} ${JSON.stringify(meta)} — ${detail}`
        : `${message} — ${detail}`,
      undefined,
      this.context,
    );
  }
}

@Injectable()
export class AppLogger {
  createContext(context: string): ContextLogger {
    return new ContextLogger(new Logger(context), context);
  }
}
