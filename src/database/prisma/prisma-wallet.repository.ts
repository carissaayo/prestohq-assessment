import { Injectable } from '@nestjs/common';
import type { Wallet as PrismaWallet } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  WalletEntity,
  WalletRepository,
  WalletStatusValue,
} from '../repositories/wallet.repository';

@Injectable()
export class PrismaWalletRepository extends WalletRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<WalletEntity | null> {
    const wallet = await this.prisma.wallet.findUnique({ where: { id } });
    return wallet ? this.toEntity(wallet) : null;
  }

  async findByUserId(userId: string): Promise<WalletEntity | null> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    return wallet ? this.toEntity(wallet) : null;
  }

  private toEntity(wallet: PrismaWallet): WalletEntity {
    return {
      id: wallet.id,
      userId: wallet.userId,
      currency: wallet.currency,
      status: wallet.status as WalletStatusValue,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }
}
