import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { AppLogger, ContextLogger } from '../../core/logger';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly log: ContextLogger;

  constructor(appLogger: AppLogger) {
    this.log = appLogger.createContext(LoggingInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: { userId?: string } }>();
    const res = http.getResponse<Response>();
    const started = Date.now();
    const method = req.method;
    const path = req.originalUrl ?? req.url;

    return next.handle().pipe(
      tap({
        next: () => {
          this.log.action('HTTP request', {
            method,
            path,
            statusCode: res.statusCode,
            durationMs: Date.now() - started,
            userId: req.user?.userId,
          });
        },
        error: (err: unknown) => {
          const statusCode =
            typeof err === 'object' &&
            err !== null &&
            'getStatus' in err &&
            typeof (err as { getStatus: () => number }).getStatus === 'function'
              ? (err as { getStatus: () => number }).getStatus()
              : 500;
          this.log.warn('HTTP request failed', {
            method,
            path,
            statusCode,
            durationMs: Date.now() - started,
            userId: req.user?.userId,
            message: err instanceof Error ? err.message : String(err),
          });
        },
      }),
    );
  }
}
