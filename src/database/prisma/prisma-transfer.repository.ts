import { Injectable } from '@nestjs/common';
import type { Transfer as PrismaTransfer } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateTransferData,
  TransferEntity,
  TransferRepository,
  TransferStatusValue,
  UpdateTransferData,
} from '../repositories/transfer.repository';

@Injectable()
export class PrismaTransferRepository extends TransferRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<TransferEntity | null> {
    const row = await this.prisma.transfer.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByUserAndIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<TransferEntity | null> {
    const row = await this.prisma.transfer.findUnique({
      where: {
        userId_idempotencyKey: { userId, idempotencyKey },
      },
    });
    return row ? this.toEntity(row) : null;
  }

  async findByFlutterwaveTxRef(
    txRef: string,
  ): Promise<TransferEntity | null> {
    const row = await this.prisma.transfer.findUnique({
      where: { flutterwaveTxRef: txRef },
    });
    return row ? this.toEntity(row) : null;
  }

  async create(data: CreateTransferData): Promise<TransferEntity> {
    const row = await this.prisma.transfer.create({
      data: {
        userId: data.userId,
        walletId: data.walletId,
        amount: data.amount,
        currency: data.currency ?? 'NGN',
        flutterwaveTxRef: data.flutterwaveTxRef,
        idempotencyKey: data.idempotencyKey,
        requestBodyHash: data.requestBodyHash,
        status: data.status ?? 'INITIATED',
      },
    });
    return this.toEntity(row);
  }

  async update(
    id: string,
    data: UpdateTransferData,
  ): Promise<TransferEntity> {
    const row = await this.prisma.transfer.update({
      where: { id },
      data: {
        status: data.status,
        flutterwaveId: data.flutterwaveId,
        checkoutUrl: data.checkoutUrl,
      },
    });
    return this.toEntity(row);
  }

  private toEntity(row: PrismaTransfer): TransferEntity {
    return {
      id: row.id,
      userId: row.userId,
      walletId: row.walletId,
      amount: row.amount,
      currency: row.currency,
      status: row.status as TransferStatusValue,
      flutterwaveTxRef: row.flutterwaveTxRef,
      flutterwaveId: row.flutterwaveId,
      checkoutUrl: row.checkoutUrl,
      idempotencyKey: row.idempotencyKey,
      requestBodyHash: row.requestBodyHash,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
