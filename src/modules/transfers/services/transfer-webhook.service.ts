import { createHash, randomUUID } from 'crypto';

import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { customError } from '../../../common/exceptions/custom-error';
import { TRANSFER_COMPLETE_QUEUE } from '../../../core/queue/queue.constants';
import { WebhookEventRepository } from '../../../database/repositories/webhook-event.repository';
import {
  FLUTTERWAVE_PROVIDER,
  type IFlutterwaveProvider,
} from '../providers/flutterwave.interface';
import { TRANSFER_COMPLETE_JOB } from '../transfers.constants';

@Injectable()
export class TransferWebhookService {
  constructor(
    private readonly webhooks: WebhookEventRepository,
    @Inject(FLUTTERWAVE_PROVIDER)
    private readonly flutterwave: IFlutterwaveProvider,
    @InjectQueue(TRANSFER_COMPLETE_QUEUE)
    private readonly transferQueue: Queue,
  ) {}

  async handleFlutterwaveWebhook(
    verifHash: string | undefined,
    body: Record<string, unknown>,
  ): Promise<{ received: true; webhookEventId: string }> {
    if (!this.flutterwave.verifyWebhookSignature(verifHash)) {
      throw customError.unauthorized('Invalid Flutterwave webhook signature');
    }

    const eventType =
      typeof body.event === 'string' ? body.event : 'charge.completed';
    const data =
      body.data && typeof body.data === 'object'
        ? (body.data as Record<string, unknown>)
        : {};
    const txRef =
      typeof data.tx_ref === 'string'
        ? data.tx_ref
        : typeof data.txRef === 'string'
          ? data.txRef
          : null;

    const providerEventId = this.resolveProviderEventId(body, data);

    const existing = await this.webhooks.findByProviderEventId(
      'FLUTTERWAVE',
      providerEventId,
    );
    if (existing) {
      if (existing.status !== 'PROCESSED') {
        await this.transferQueue.add(
          TRANSFER_COMPLETE_JOB,
          { webhookEventId: existing.id },
          { jobId: `transfer-complete-${existing.id}`, removeOnComplete: true },
        );
      }
      return { received: true, webhookEventId: existing.id };
    }

    const created = await this.webhooks.create({
      provider: 'FLUTTERWAVE',
      eventType,
      providerEventId,
      reference: txRef,
      payload: body,
    });

    await this.transferQueue.add(
      TRANSFER_COMPLETE_JOB,
      { webhookEventId: created.id },
      { jobId: `transfer-complete-${created.id}`, removeOnComplete: true },
    );

    return { received: true, webhookEventId: created.id };
  }

  private resolveProviderEventId(
    body: Record<string, unknown>,
    data: Record<string, unknown>,
  ): string {
    if (typeof data.id === 'string' || typeof data.id === 'number') {
      return `flw-${data.id}`;
    }
    if (typeof body.id === 'string' || typeof body.id === 'number') {
      return `flw-${body.id}`;
    }
    // Stable fallback for payloads without an id (e.g. mock tests).
    const digest = createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex')
      .slice(0, 32);
    return `flw-hash-${digest || randomUUID()}`;
  }
}
