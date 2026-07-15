import { Injectable } from '@nestjs/common';
import type {
  WalletTransaction as PrismaWalletTx,
  Withdrawal as PrismaWithdrawal,
} from '@prisma/client';

import { customError } from '../../common/exceptions/custom-error';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExecuteP2pWithdrawalData,
  ExecuteP2pWithdrawalResult,
  WithdrawalEntity,
  WithdrawalRepository,
  WithdrawalStatusValue,
  WithdrawalDestinationTypeValue,
} from '../repositories/withdrawal.repository';
import {
  lockWalletRow,
  sortWalletIds,
  sumSuccessfulBalance,
} from './ledger-lock.util';

@Injectable()
export class PrismaWithdrawalRepository extends WithdrawalRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<WithdrawalEntity | null> {
    const row = await this.prisma.withdrawal.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByUserAndIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<WithdrawalEntity | null> {
    const row = await this.prisma.withdrawal.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    return row ? this.toEntity(row) : null;
  }

  async executeP2p(
    data: ExecuteP2pWithdrawalData,
  ): Promise<ExecuteP2pWithdrawalResult> {
    const existing = await this.findByUserAndIdempotencyKey(
      data.userId,
      data.idempotencyKey,
    );
    if (existing) {
      if (existing.requestBodyHash !== data.requestBodyHash) {
        throw customError.conflict(
          'Idempotency-Key was already used with a different request body',
        );
      }
      return { withdrawal: existing, created: false };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const again = await tx.withdrawal.findUnique({
          where: {
            userId_idempotencyKey: {
              userId: data.userId,
              idempotencyKey: data.idempotencyKey,
            },
          },
        });
        if (again) {
          return { withdrawal: this.toEntity(again), created: false };
        }

        for (const walletId of sortWalletIds(
          data.senderWalletId,
          data.destinationWalletId,
        )) {
          await lockWalletRow(tx, walletId);
        }

        const available = await sumSuccessfulBalance(tx, data.senderWalletId);
        if (available < data.amount) {
          throw customError.unprocessableEntity('Insufficient wallet balance');
        }

        const withdrawal = await tx.withdrawal.create({
          data: {
            userId: data.userId,
            walletId: data.senderWalletId,
            amount: data.amount,
            currency: data.currency,
            destinationType: 'WALLET',
            destinationWalletId: data.destinationWalletId,
            status: 'SUCCESSFUL',
            idempotencyKey: data.idempotencyKey,
            requestBodyHash: data.requestBodyHash,
          },
        });

        const debit = await tx.walletTransaction.create({
          data: {
            walletId: data.senderWalletId,
            type: 'DEBIT',
            purpose: 'P2P',
            status: 'SUCCESSFUL',
            amount: data.amount,
            idempotencyKey: `p2p-debit:${data.userId}:${data.idempotencyKey}`,
            counterpartWalletId: data.destinationWalletId,
            withdrawalId: withdrawal.id,
          },
        });

        const credit = await tx.walletTransaction.create({
          data: {
            walletId: data.destinationWalletId,
            type: 'CREDIT',
            purpose: 'P2P',
            status: 'SUCCESSFUL',
            amount: data.amount,
            idempotencyKey: `p2p-credit:${data.userId}:${data.idempotencyKey}`,
            counterpartWalletId: data.senderWalletId,
            withdrawalId: withdrawal.id,
          },
        });

        const updated = await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            debitTransactionId: debit.id,
            creditTransactionId: credit.id,
          },
        });

        void (debit as PrismaWalletTx);
        void (credit as PrismaWalletTx);

        return { withdrawal: this.toEntity(updated), created: true };
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('Wallet not found:')
      ) {
        throw customError.notFound('Wallet not found');
      }
      throw error;
    }
  }

  private toEntity(row: PrismaWithdrawal): WithdrawalEntity {
    return {
      id: row.id,
      userId: row.userId,
      walletId: row.walletId,
      amount: row.amount,
      currency: row.currency,
      destinationType: row.destinationType as WithdrawalDestinationTypeValue,
      destinationWalletId: row.destinationWalletId,
      bankCode: row.bankCode,
      accountNumber: row.accountNumber,
      accountName: row.accountName,
      status: row.status as WithdrawalStatusValue,
      providerReference: row.providerReference,
      providerTransferId: row.providerTransferId,
      debitTransactionId: row.debitTransactionId,
      creditTransactionId: row.creditTransactionId,
      reversalTransactionId: row.reversalTransactionId,
      idempotencyKey: row.idempotencyKey,
      requestBodyHash: row.requestBodyHash,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
