import { Injectable } from '@nestjs/common';

import { WalletTransactionRepository } from '../../../database/repositories/wallet-transaction.repository';
import type {
  CompleteCreditInput,
  LedgerWriteResult,
  PostCreditPendingInput,
  PostDebitInput,
  PostReversalInput,
} from '../interfaces/wallet-ledger.interface';
import { WalletLedgerCreditService } from './wallet-ledger-credit.service';
import { WalletLedgerDebitService } from './wallet-ledger-debit.service';

/**
 * Facade for journal writes. Option A: FOR UPDATE + fresh SUM for debits.
 * Exported for transfers/withdrawals modules.
 */
@Injectable()
export class WalletLedgerService {
  constructor(
    private readonly credits: WalletLedgerCreditService,
    private readonly debits: WalletLedgerDebitService,
    private readonly journal: WalletTransactionRepository,
  ) {}

  getSuccessfulBalance(walletId: string): Promise<number> {
    return this.journal.getSuccessfulBalance(walletId);
  }

  postCreditPending(input: PostCreditPendingInput): Promise<LedgerWriteResult> {
    return this.credits.postPending(input);
  }

  completeCreditSuccessful(
    input: CompleteCreditInput,
  ): Promise<LedgerWriteResult> {
    return this.credits.completeSuccessful(input);
  }

  postDebitSuccessful(input: PostDebitInput): Promise<LedgerWriteResult> {
    return this.debits.postSuccessful(input);
  }

  postReversalCredit(input: PostReversalInput): Promise<LedgerWriteResult> {
    return this.debits.postReversal(input);
  }
}
