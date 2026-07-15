import { createHash } from 'crypto';

import { plainToInstance } from 'class-transformer';
import { IsUUID, validateSync } from 'class-validator';

import { customError } from '../exceptions/custom-error';

class IdempotencyKeyDto {
  @IsUUID('4')
  key!: string;
}

export function requireIdempotencyKey(
  headerValue: string | string[] | undefined,
): string {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!raw?.trim()) {
    throw customError.badRequest('Idempotency-Key header is required');
  }

  const dto = plainToInstance(IdempotencyKeyDto, { key: raw.trim() });
  const errors = validateSync(dto);
  if (errors.length > 0) {
    throw customError.badRequest('Idempotency-Key must be a UUID v4');
  }

  return dto.key;
}

export function hashRequestBody(body: unknown): string {
  const normalized = JSON.stringify(body ?? {});
  return createHash('sha256').update(normalized).digest('hex');
}
