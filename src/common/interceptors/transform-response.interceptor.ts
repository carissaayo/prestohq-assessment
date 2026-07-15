import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SKIP_RESPONSE_TRANSFORM_KEY } from '../decorators/skip-response-transform.decorator';
import {
  buildSuccessResponse,
  type ApiSuccessResponse,
} from '../handlers/response-handler';

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_RESPONSE_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skip) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        if (
          typeof data === 'object' &&
          data !== null &&
          'statusCode' in data &&
          'status' in data &&
          'data' in data &&
          'meta' in data
        ) {
          return data as ApiSuccessResponse;
        }

        const response = context
          .switchToHttp()
          .getResponse<{ statusCode: number }>();
        return buildSuccessResponse(response.statusCode, data);
      }),
    );
  }
}
