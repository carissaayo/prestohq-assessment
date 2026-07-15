import { Injectable } from '@nestjs/common';

import { customError } from '../../../common/exceptions/custom-error';
import { WalletTransactionRepository } from '../../../database/repositories/wallet-transaction.repository';
import type {
  LedgerWriteResult,
  PostDebitInput,
  PostReversalInput,
} from '../interfaces/wallet-ledger.interface';

@Injectable()
export class WalletLedgerDebitService {
  constructor(private readonly journal: WalletTransactionRepository) {}

  async postSuccessful(input: PostDebitInput): Promise<LedgerWriteResult> {
    this.assertAmount(input.amount);

    const existing = await this.journal.findByIdempotencyKey(
      input.idempotencyKey,
    );
    if (existing) {
      return { transaction: existing, created: false };
    }

    try {
      return await this.journal.withTransaction(async (ops) => {
        await ops.lockWallet(input.walletId);

        const again = await ops.findByIdempotencyKey(input.idempotencyKey);
        if (again) {
          return { transaction: again, created: false };
        }

        const available = await ops.getSuccessfulBalance(input.walletId);
        if (available < input.amount) {
          throw customError.unprocessableEntity('Insufficient wallet balance');
        }

        const transaction = await ops.insert({
          walletId: input.walletId,
          type: 'DEBIT',
          purpose: input.purpose,
          status: 'SUCCESSFUL',
          amount: input.amount,
          idempotencyKey: input.idempotencyKey,
          reference: input.reference,
          counterpartWalletId: input.counterpartWalletId,
          withdrawalId: input.withdrawalId,
        });

        const balanceAfter = await ops.getSuccessfulBalance(input.walletId);
        return { transaction, created: true, balanceAfter };
      });
    } catch (error) {
      this.rethrowWalletMissing(error, input.walletId);
    }
  }

  async postReversal(input: PostReversalInput): Promise<LedgerWriteResult> {
    this.assertAmount(input.amount);

    const existing = await this.journal.findByIdempotencyKey(
      input.idempotencyKey,
    );
    if (existing) {
      return { transaction: existing, created: false };
    }

    const original = await this.journal.findById(input.originalDebitId);
    if (!original || original.type !== 'DEBIT') {
      throw customError.badRequest('Original debit transaction not found');
    }
    if (original.walletId !== input.walletId) {
      throw customError.badRequest('Reversal wallet mismatch');
    }
    if (original.amount !== input.amount) {
      throw customError.badRequest('Reversal amount must match original debit');
    }

    try {
      return await this.journal.withTransaction(async (ops) => {
        await ops.lockWallet(input.walletId);

        const again = await ops.findByIdempotencyKey(input.idempotencyKey);
        if (again) {
          return { transaction: again, created: false };
        }

        const transaction = await ops.insert({
          walletId: input.walletId,
          type: 'CREDIT',
          purpose: 'REVERSAL',
          status: 'SUCCESSFUL',
          amount: input.amount,
          idempotencyKey: input.idempotencyKey,
          reference: input.reference,
          withdrawalId: input.withdrawalId,
          reversesTransactionId: input.originalDebitId,
        });

        const balanceAfter = await ops.getSuccessfulBalance(input.walletId);
        return { transaction, created: true, balanceAfter };
      });
    } catch (error) {
      this.rethrowWalletMissing(error, input.walletId);
    }
  }

  private assertAmount(amount: number): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw customError.badRequest('amount must be a positive integer (kobo)');
    }
  }

  private rethrowWalletMissing(error: unknown, walletId: string): never {
    if (
      error instanceof Error &&
      error.message.includes(`Wallet not found: ${walletId}`)
    ) {
      throw customError.notFound('Wallet not found');
    }
    throw error;
  }
}
