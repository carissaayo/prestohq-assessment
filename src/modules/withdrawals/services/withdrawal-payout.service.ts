import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { AppLogger, ContextLogger } from '../../../core/logger';
import { WITHDRAWAL_SETTLE_QUEUE } from '../../../core/queue/queue.constants';
import { WithdrawalRepository } from '../../../database/repositories/withdrawal.repository';
import { WalletLedgerService } from '../../wallets/services/wallet-ledger.service';
import {
  FLUTTERWAVE_PROVIDER,
  type IFlutterwaveProvider,
} from '../../transfers/providers/flutterwave.interface';
import {
  WITHDRAWAL_SETTLE_JOB,
} from '../withdrawals.constants';

@Injectable()
export class WithdrawalPayoutService {
  private readonly log: ContextLogger;

  constructor(
    private readonly withdrawals: WithdrawalRepository,
    private readonly ledger: WalletLedgerService,
    @Inject(FLUTTERWAVE_PROVIDER)
    private readonly flutterwave: IFlutterwaveProvider,
    @InjectQueue(WITHDRAWAL_SETTLE_QUEUE)
    private readonly settleQueue: Queue,
    appLogger: AppLogger,
  ) {
    this.log = appLogger.createContext(WithdrawalPayoutService.name);
  }

  async processPayout(withdrawalId: string): Promise<void> {
    const withdrawal = await this.withdrawals.findById(withdrawalId);
    if (!withdrawal) {
      this.log.warn('Withdrawal missing for payout', { withdrawalId });
      return;
    }

    if (
      withdrawal.status === 'SUCCESSFUL' ||
      withdrawal.status === 'FAILED' ||
      withdrawal.status === 'REVERSED'
    ) {
      return;
    }

    if (withdrawal.destinationType !== 'BANK') {
      return;
    }

    const result = await this.flutterwave.initiateBankTransfer({
      reference: withdrawal.providerReference!,
      amountKobo: withdrawal.amount,
      currency: withdrawal.currency,
      bankCode: withdrawal.bankCode!,
      accountNumber: withdrawal.accountNumber!,
      narration: `Wallet withdrawal ${withdrawal.id}`,
    });

    if (result.status === 'FAILED') {
      await this.reverseAndFail(withdrawal.id, withdrawal.walletId, withdrawal.amount, withdrawal.debitTransactionId!);
      this.log.action('Bank payout failed on initiate — reversed', {
        withdrawalId,
      });
      return;
    }

    await this.withdrawals.update(withdrawal.id, {
      providerTransferId: result.transferId ?? null,
      status: result.status === 'SUCCESSFUL' ? 'SUCCESSFUL' : 'PROCESSING',
    });

    if (result.status === 'SUCCESSFUL') {
      this.log.action('Bank payout successful', { withdrawalId });
      return;
    }

    await this.settleQueue.add(
      WITHDRAWAL_SETTLE_JOB,
      { withdrawalId },
      {
        jobId: `withdrawal-settle-${withdrawalId}`,
        delay: 2000,
        removeOnComplete: true,
        attempts: 5,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
  }

  private async reverseAndFail(
    withdrawalId: string,
    walletId: string,
    amount: number,
    debitTransactionId: string,
  ): Promise<void> {
    const reversal = await this.ledger.postReversalCredit({
      walletId,
      amount,
      originalDebitId: debitTransactionId,
      idempotencyKey: `reversal:${debitTransactionId}`,
      withdrawalId,
      reference: `rev_${withdrawalId}`,
    });

    await this.withdrawals.update(withdrawalId, {
      status: 'REVERSED',
      reversalTransactionId: reversal.transaction.id,
    });
  }
}
