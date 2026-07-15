import { HttpException } from '@nestjs/common';

export enum ErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.BAD_REQUEST]: 'Bad Request',
  [ErrorCode.UNAUTHORIZED]: 'Unauthorized',
  [ErrorCode.FORBIDDEN]: 'Forbidden',
  [ErrorCode.NOT_FOUND]: 'Not Found',
  [ErrorCode.CONFLICT]: 'Conflict',
  [ErrorCode.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [ErrorCode.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

const ErrorStatusCodes: Record<ErrorCode, number> = {
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.UNPROCESSABLE_ENTITY]: 422,
  [ErrorCode.TOO_MANY_REQUESTS]: 429,
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
};

export type ErrorMessage = string | string[];

export class AppException extends HttpException {
  readonly errorCode?: string;
  readonly data?: unknown;

  constructor(
    message: ErrorMessage,
    statusCode: number,
    errorCode?: string,
    data?: unknown,
  ) {
    super({ message, statusCode, errorCode, data }, statusCode);
    this.errorCode = errorCode;
    this.data = data;
  }
}

function build(
  code: ErrorCode,
  message?: ErrorMessage,
  data?: unknown,
): AppException {
  return new AppException(
    message ?? ErrorMessages[code],
    ErrorStatusCodes[code],
    code,
    data,
  );
}

export const customError = {
  badRequest: (message?: ErrorMessage, data?: unknown) =>
    build(ErrorCode.BAD_REQUEST, message, data),
  unauthorized: (message?: ErrorMessage, data?: unknown) =>
    build(ErrorCode.UNAUTHORIZED, message, data),
  forbidden: (message?: ErrorMessage, data?: unknown) =>
    build(ErrorCode.FORBIDDEN, message, data),
  notFound: (message?: ErrorMessage, data?: unknown) =>
    build(ErrorCode.NOT_FOUND, message, data),
  conflict: (message?: ErrorMessage, data?: unknown) =>
    build(ErrorCode.CONFLICT, message, data),
  unprocessableEntity: (message?: ErrorMessage, data?: unknown) =>
    build(ErrorCode.UNPROCESSABLE_ENTITY, message, data),
  tooManyRequests: (message?: ErrorMessage, data?: unknown) =>
    build(ErrorCode.TOO_MANY_REQUESTS, message, data),
  internalServerError: (message?: ErrorMessage, data?: unknown) =>
    build(ErrorCode.INTERNAL_SERVER_ERROR, message, data),
};
