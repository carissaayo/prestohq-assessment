import { Injectable } from '@nestjs/common';
import type { Withdrawal as PrismaWithdrawal } from '@prisma/client';

import { customError } from '../../common/exceptions/custom-error';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ExecuteBankWithdrawalData,
  ExecuteBankWithdrawalResult,
  ExecuteP2pWithdrawalData,
  ExecuteP2pWithdrawalResult,
  UpdateWithdrawalProviderData,
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

        void debit;
        void credit;

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

  async findByProviderReference(
    providerReference: string,
  ): Promise<WithdrawalEntity | null> {
    const row = await this.prisma.withdrawal.findUnique({
      where: { providerReference },
    });
    return row ? this.toEntity(row) : null;
  }

  async executeBankAccept(
    data: ExecuteBankWithdrawalData,
  ): Promise<ExecuteBankWithdrawalResult> {
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

        await lockWalletRow(tx, data.walletId);

        const available = await sumSuccessfulBalance(tx, data.walletId);
        if (available < data.amount) {
          throw customError.unprocessableEntity('Insufficient wallet balance');
        }

        const withdrawal = await tx.withdrawal.create({
          data: {
            userId: data.userId,
            walletId: data.walletId,
            amount: data.amount,
            currency: data.currency,
            destinationType: 'BANK',
            bankCode: data.bankCode,
            accountNumber: data.accountNumber,
            accountName: data.accountName,
            status: 'PROCESSING',
            providerReference: data.providerReference,
            idempotencyKey: data.idempotencyKey,
            requestBodyHash: data.requestBodyHash,
          },
        });

        const debit = await tx.walletTransaction.create({
          data: {
            walletId: data.walletId,
            type: 'DEBIT',
            purpose: 'BANK_PAYOUT',
            status: 'SUCCESSFUL',
            amount: data.amount,
            idempotencyKey: `bank-debit:${data.userId}:${data.idempotencyKey}`,
            reference: data.providerReference,
            withdrawalId: withdrawal.id,
          },
        });

        const updated = await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: { debitTransactionId: debit.id },
        });

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

  async update(
    id: string,
    data: UpdateWithdrawalProviderData,
  ): Promise<WithdrawalEntity> {
    const row = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: data.status,
        providerTransferId: data.providerTransferId,
        debitTransactionId: data.debitTransactionId,
        creditTransactionId: data.creditTransactionId,
        reversalTransactionId: data.reversalTransactionId,
      },
    });
    return this.toEntity(row);
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
