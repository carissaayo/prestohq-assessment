import { Injectable } from '@nestjs/common';
import type {
  Prisma,
  WalletTransaction as PrismaWalletTx,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWalletTransactionData,
  LedgerTxOps,
  ListWalletTransactionsParams,
  ListWalletTransactionsResult,
  WalletTransactionEntity,
  WalletTransactionRepository,
  WalletTxStatus,
} from '../repositories/wallet-transaction.repository';
import { lockWalletRow, sumSuccessfulBalance } from './ledger-lock.util';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class PrismaWalletTransactionRepository extends WalletTransactionRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getSuccessfulBalance(walletId: string): Promise<number> {
    return sumSuccessfulBalance(this.prisma, walletId);
  }

  async findById(id: string): Promise<WalletTransactionEntity | null> {
    const row = await this.prisma.walletTransaction.findUnique({
      where: { id },
    });
    return row ? this.toEntity(row) : null;
  }

  async findByIdempotencyKey(
    key: string,
  ): Promise<WalletTransactionEntity | null> {
    const row = await this.prisma.walletTransaction.findUnique({
      where: { idempotencyKey: key },
    });
    return row ? this.toEntity(row) : null;
  }

  async findByTransferId(
    transferId: string,
  ): Promise<WalletTransactionEntity[]> {
    const rows = await this.prisma.walletTransaction.findMany({
      where: { transferId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toEntity(r));
  }

  async listByWalletId(
    params: ListWalletTransactionsParams,
  ): Promise<ListWalletTransactionsResult> {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);

    const rows = await this.prisma.walletTransaction.findMany({
      where: { walletId: params.walletId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(params.cursor
        ? { cursor: { id: params.cursor }, skip: 1 }
        : {}),
    });

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: slice.map((r) => this.toEntity(r)),
      nextCursor: hasMore ? slice[slice.length - 1].id : null,
    };
  }

  async withTransaction<T>(fn: (ops: LedgerTxOps) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const ops: LedgerTxOps = {
        lockWallet: (walletId) => lockWalletRow(tx, walletId),
        getSuccessfulBalance: (walletId) => sumSuccessfulBalance(tx, walletId),
        insert: (data) => this.insert(tx, data),
        findById: async (id) => {
          const row = await tx.walletTransaction.findUnique({ where: { id } });
          return row ? this.toEntity(row) : null;
        },
        findByIdempotencyKey: async (key) => {
          const row = await tx.walletTransaction.findUnique({
            where: { idempotencyKey: key },
          });
          return row ? this.toEntity(row) : null;
        },
        updateStatus: (id, status) => this.updateStatus(tx, id, status),
      };
      return fn(ops);
    });
  }

  private async insert(
    tx: TxClient,
    data: CreateWalletTransactionData,
  ): Promise<WalletTransactionEntity> {
    const row = await tx.walletTransaction.create({
      data: {
        walletId: data.walletId,
        type: data.type,
        purpose: data.purpose,
        status: data.status,
        amount: data.amount,
        idempotencyKey: data.idempotencyKey,
        reference: data.reference ?? null,
        counterpartWalletId: data.counterpartWalletId ?? null,
        transferId: data.transferId ?? null,
        withdrawalId: data.withdrawalId ?? null,
        reversesTransactionId: data.reversesTransactionId ?? null,
      },
    });
    return this.toEntity(row);
  }

  private async updateStatus(
    tx: TxClient,
    id: string,
    status: WalletTxStatus,
  ): Promise<WalletTransactionEntity> {
    const row = await tx.walletTransaction.update({
      where: { id },
      data: { status },
    });
    return this.toEntity(row);
  }

  private toEntity(row: PrismaWalletTx): WalletTransactionEntity {
    return {
      id: row.id,
      walletId: row.walletId,
      type: row.type,
      purpose: row.purpose,
      status: row.status,
      amount: row.amount,
      idempotencyKey: row.idempotencyKey,
      reference: row.reference,
      counterpartWalletId: row.counterpartWalletId,
      transferId: row.transferId,
      withdrawalId: row.withdrawalId,
      reversesTransactionId: row.reversesTransactionId,
      createdAt: row.createdAt,
    };
  }
}
