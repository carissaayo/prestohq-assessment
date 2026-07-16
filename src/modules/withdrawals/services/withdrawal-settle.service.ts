import { Inject, Injectable } from '@nestjs/common';

import { AppLogger, ContextLogger } from '../../../core/logger';
import { WithdrawalRepository } from '../../../database/repositories/withdrawal.repository';
import { WalletLedgerService } from '../../wallets/services/wallet-ledger.service';
import {
  FLUTTERWAVE_PROVIDER,
  type IFlutterwaveProvider,
} from '../../payment-providers/flutterwave/flutterwave-payment.interface';

@Injectable()
export class WithdrawalSettleService {
  private readonly log: ContextLogger;

  constructor(
    private readonly withdrawals: WithdrawalRepository,
    private readonly ledger: WalletLedgerService,
    @Inject(FLUTTERWAVE_PROVIDER)
    private readonly flutterwave: IFlutterwaveProvider,
    appLogger: AppLogger,
  ) {
    this.log = appLogger.createContext(WithdrawalSettleService.name);
  }

  async processSettle(withdrawalId: string): Promise<void> {
    const withdrawal = await this.withdrawals.findById(withdrawalId);
    if (!withdrawal) {
      return;
    }

    if (
      withdrawal.status === 'SUCCESSFUL' ||
      withdrawal.status === 'FAILED' ||
      withdrawal.status === 'REVERSED'
    ) {
      return;
    }

    if (!withdrawal.providerTransferId) {
      this.log.warn('Settle skipped — no providerTransferId', { withdrawalId });
      return;
    }

    const status = await this.flutterwave.getBankTransferStatus(
      withdrawal.providerTransferId,
    );

    if (status.status === 'SUCCESSFUL') {
      await this.withdrawals.update(withdrawal.id, { status: 'SUCCESSFUL' });
      this.log.action('Bank payout settled successful', { withdrawalId });
      return;
    }

    if (status.status === 'FAILED') {
      const debitId = withdrawal.debitTransactionId;
      if (!debitId) {
        this.log.fail('Cannot reverse — missing debitTransactionId', undefined, {
          withdrawalId,
        });
        return;
      }

      const reversal = await this.ledger.postReversalCredit({
        walletId: withdrawal.walletId,
        amount: withdrawal.amount,
        originalDebitId: debitId,
        idempotencyKey: `reversal:${debitId}`,
        withdrawalId: withdrawal.id,
        reference: `rev_${withdrawal.id}`,
      });

      await this.withdrawals.update(withdrawal.id, {
        status: 'REVERSED',
        reversalTransactionId: reversal.transaction.id,
      });
      this.log.action('Bank payout settled failed — reversed', { withdrawalId });
      return;
    }

    // Still pending — throw so BullMQ retries with backoff
    throw new Error(`Bank transfer still pending: ${withdrawalId}`);
  }
}
