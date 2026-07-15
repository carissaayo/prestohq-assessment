import { Injectable } from '@nestjs/common';

import { customError } from '../../../common/exceptions/custom-error';
import { WalletTransactionRepository } from '../../../database/repositories/wallet-transaction.repository';
import type {
  CompleteCreditInput,
  LedgerWriteResult,
  PostCreditPendingInput,
} from '../interfaces/wallet-ledger.interface';

@Injectable()
export class WalletLedgerCreditService {
  constructor(private readonly journal: WalletTransactionRepository) {}

  async postPending(input: PostCreditPendingInput): Promise<LedgerWriteResult> {
    this.assertAmount(input.amount);

    const existing = await this.journal.findByIdempotencyKey(
      input.idempotencyKey,
    );
    if (existing) {
      return { transaction: existing, created: false };
    }

    return this.journal.withTransaction(async (ops) => {
      await ops.lockWallet(input.walletId);

      const again = await ops.findByIdempotencyKey(input.idempotencyKey);
      if (again) {
        return { transaction: again, created: false };
      }

      const transaction = await ops.insert({
        walletId: input.walletId,
        type: 'CREDIT',
        purpose: input.purpose,
        status: 'PENDING',
        amount: input.amount,
        idempotencyKey: input.idempotencyKey,
        reference: input.reference,
        transferId: input.transferId,
      });

      return { transaction, created: true };
    });
  }

  async completeSuccessful(
    input: CompleteCreditInput,
  ): Promise<LedgerWriteResult> {
    return this.journal.withTransaction(async (ops) => {
      const current = await ops.findById(input.transactionId);
      if (!current) {
        throw customError.notFound('Wallet transaction not found');
      }

      if (current.walletId !== input.expectedWalletId) {
        throw customError.badRequest('Transaction wallet mismatch');
      }

      await ops.lockWallet(current.walletId);

      const locked = await ops.findById(input.transactionId);
      if (!locked) {
        throw customError.notFound('Wallet transaction not found');
      }

      if (locked.status === 'SUCCESSFUL') {
        const balanceAfter = await ops.getSuccessfulBalance(locked.walletId);
        return { transaction: locked, created: false, balanceAfter };
      }

      if (locked.status !== 'PENDING') {
        throw customError.unprocessableEntity(
          `Cannot complete credit in status ${locked.status}`,
        );
      }

      const transaction = await ops.updateStatus(locked.id, 'SUCCESSFUL');
      const balanceAfter = await ops.getSuccessfulBalance(locked.walletId);
      return { transaction, created: true, balanceAfter };
    });
  }

  private assertAmount(amount: number): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw customError.badRequest('amount must be a positive integer (kobo)');
    }
  }
}
