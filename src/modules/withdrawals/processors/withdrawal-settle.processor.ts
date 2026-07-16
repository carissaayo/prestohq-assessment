import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';

import { AppLogger, ContextLogger } from '../../../core/logger';
import { WITHDRAWAL_SETTLE_QUEUE } from '../../../core/queue/queue.constants';
import { WithdrawalSettleService } from '../services/withdrawal-settle.service';
import {
  WITHDRAWAL_SETTLE_JOB,
  type WithdrawalJobData,
} from '../withdrawals.constants';

@Injectable()
@Processor(WITHDRAWAL_SETTLE_QUEUE)
export class WithdrawalSettleProcessor extends WorkerHost {
  private readonly log: ContextLogger;

  constructor(
    private readonly settleService: WithdrawalSettleService,
    appLogger: AppLogger,
  ) {
    super();
    this.log = appLogger.createContext(WithdrawalSettleProcessor.name);
  }

  async process(job: Job<WithdrawalJobData>): Promise<void> {
    if (job.name !== WITHDRAWAL_SETTLE_JOB) return;
    this.log.action('withdrawal.settle job started', {
      jobId: job.id,
      withdrawalId: job.data.withdrawalId,
    });
    try {
      await this.settleService.processSettle(job.data.withdrawalId);
      this.log.action('withdrawal.settle job finished', {
        jobId: job.id,
        withdrawalId: job.data.withdrawalId,
      });
    } catch (error) {
      this.log.fail('withdrawal.settle failed', error, {
        withdrawalId: job.data.withdrawalId,
      });
      throw error;
    }
  }
}
