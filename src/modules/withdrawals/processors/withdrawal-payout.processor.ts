import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';

import { AppLogger, ContextLogger } from '../../../core/logger';
import { WITHDRAWAL_PAYOUT_QUEUE } from '../../../core/queue/queue.constants';
import { WithdrawalPayoutService } from '../services/withdrawal-payout.service';
import {
  WITHDRAWAL_PAYOUT_JOB,
  type WithdrawalJobData,
} from '../withdrawals.constants';

@Injectable()
@Processor(WITHDRAWAL_PAYOUT_QUEUE)
export class WithdrawalPayoutProcessor extends WorkerHost {
  private readonly log: ContextLogger;

  constructor(
    private readonly payoutService: WithdrawalPayoutService,
    appLogger: AppLogger,
  ) {
    super();
    this.log = appLogger.createContext(WithdrawalPayoutProcessor.name);
  }

  async process(job: Job<WithdrawalJobData>): Promise<void> {
    if (job.name !== WITHDRAWAL_PAYOUT_JOB) return;
    this.log.action('withdrawal.payout job started', {
      jobId: job.id,
      withdrawalId: job.data.withdrawalId,
    });
    try {
      await this.payoutService.processPayout(job.data.withdrawalId);
      this.log.action('withdrawal.payout job finished', {
        jobId: job.id,
        withdrawalId: job.data.withdrawalId,
      });
    } catch (error) {
      this.log.fail('withdrawal.payout failed', error, {
        withdrawalId: job.data.withdrawalId,
      });
      throw error;
    }
  }
}
