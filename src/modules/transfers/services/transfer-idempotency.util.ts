import { createHash, randomUUID } from 'crypto';

import {
  hashRequestBody,
  requireIdempotencyKey,
} from '../../../common/utils/idempotency';

export { hashRequestBody, requireIdempotencyKey };

export function newFlutterwaveTxRef(userId: string): string {
  return `fund_${userId.slice(0, 8)}_${randomUUID().replace(/-/g, '')}`;
}

/** @deprecated digest helper kept for webhook fallback uniqueness */
export function stablePayloadDigest(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}
