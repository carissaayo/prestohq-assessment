import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AppException } from '../exceptions/custom-error';

interface ErrorResponseBody {
  success: false;
  statusCode: number;
  message: string | string[];
  errorCode?: string;
  data?: unknown;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ErrorResponseBody = {
      success: false,
      statusCode: status,
      message: this.resolveMessage(exception, status),
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    };

    if (exception instanceof AppException && status < 500) {
      if (exception.errorCode) {
        body.errorCode = exception.errorCode;
      }
      if (exception.data !== undefined && exception.data !== null) {
        body.data = exception.data;
      }
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : exception,
      );
    }

    response.status(status).json(body);
  }

  private resolveMessage(
    exception: unknown,
    status: number,
  ): string | string[] {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return res;
      }
      if (typeof res === 'object' && res !== null && 'message' in res) {
        return (res as { message: string | string[] }).message;
      }
    }

    return status >= 500 ? 'Internal server error' : 'Request failed';
  }
}
