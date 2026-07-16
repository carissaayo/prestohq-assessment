import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { customError } from '../../../common/exceptions/custom-error';
import { AppLogger, ContextLogger } from '../../../core/logger';
import { TRANSFER_COMPLETE_QUEUE } from '../../../core/queue/queue.constants';
import { WebhookEventRepository } from '../../../database/repositories/webhook-event.repository';
import {
  FLUTTERWAVE_PROVIDER,
  type IFlutterwaveProvider,
} from '../../payment-providers/flutterwave/flutterwave-payment.interface';
import { TRANSFER_COMPLETE_JOB } from '../transfers.constants';

@Injectable()
export class TransferWebhookService {
  private readonly log: ContextLogger;

  constructor(
    private readonly webhooks: WebhookEventRepository,
    @Inject(FLUTTERWAVE_PROVIDER)
    private readonly flutterwave: IFlutterwaveProvider,
    @InjectQueue(TRANSFER_COMPLETE_QUEUE)
    private readonly transferQueue: Queue,
    appLogger: AppLogger,
  ) {
    this.log = appLogger.createContext(TransferWebhookService.name);
  }

  async handleFlutterwaveWebhook(
    verifHash: string | undefined,
    body: Record<string, unknown>,
  ): Promise<{ received: true; webhookEventId: string }> {
    if (!this.flutterwave.verifyWebhookSignature(verifHash)) {
      this.log.warn('Flutterwave webhook signature rejected');
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

    const providerEventId = this.requireProviderEventId(body, data);

    this.log.action('Flutterwave webhook received', {
      eventType,
      providerEventId,
      txRef,
    });

    const existing = await this.webhooks.findByProviderEventId(
      'FLUTTERWAVE',
      providerEventId,
    );
    if (existing) {
      this.log.action('Flutterwave webhook duplicate', {
        webhookEventId: existing.id,
        status: existing.status,
      });
      if (existing.status !== 'PROCESSED') {
        await this.transferQueue.add(
          TRANSFER_COMPLETE_JOB,
          { webhookEventId: existing.id },
          { jobId: `transfer-complete-${existing.id}`, removeOnComplete: true },
        );
        this.log.action('Re-enqueued transfer.complete', {
          webhookEventId: existing.id,
        });
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

    this.log.action('Enqueued transfer.complete', {
      webhookEventId: created.id,
      providerEventId,
      txRef,
    });

    return { received: true, webhookEventId: created.id };
  }

  /** Flutterwave charge/transfer payloads expose a stable numeric/string `data.id`. */
  private requireProviderEventId(
    body: Record<string, unknown>,
    data: Record<string, unknown>,
  ): string {
    if (typeof data.id === 'string' || typeof data.id === 'number') {
      return `flw-${data.id}`;
    }
    if (typeof body.id === 'string' || typeof body.id === 'number') {
      return `flw-${body.id}`;
    }
    throw customError.badRequest(
      'Flutterwave webhook missing provider event id (data.id)',
    );
  }
}
