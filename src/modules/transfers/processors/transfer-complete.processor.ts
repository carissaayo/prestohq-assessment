import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';

import { TRANSFER_COMPLETE_QUEUE } from '../../../core/queue/queue.constants';
import { AppLogger, ContextLogger } from '../../../core/logger';
import { TransferCompleteService } from '../services/transfer-complete.service';
import {
  TRANSFER_COMPLETE_JOB,
  type TransferCompleteJobData,
} from '../transfers.constants';

@Injectable()
@Processor(TRANSFER_COMPLETE_QUEUE)
export class TransferCompleteProcessor extends WorkerHost {
  private readonly log: ContextLogger;

  constructor(
    private readonly completeService: TransferCompleteService,
    appLogger: AppLogger,
  ) {
    super();
    this.log = appLogger.createContext(TransferCompleteProcessor.name);
  }

  async process(job: Job<TransferCompleteJobData>): Promise<void> {
    if (job.name !== TRANSFER_COMPLETE_JOB) {
      return;
    }

    try {
      await this.completeService.completeFromWebhook(job.data.webhookEventId);
    } catch (error) {
      this.log.fail('transfer.complete failed', error, {
        webhookEventId: job.data.webhookEventId,
      });
      throw error;
    }
  }
}
