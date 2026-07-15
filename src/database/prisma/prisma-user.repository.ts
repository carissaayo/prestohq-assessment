import { Injectable } from '@nestjs/common';
import type { User as PrismaUser } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateUserWithWalletData,
  UserEntity,
  UserRepository,
  UserWithWalletEntity,
} from '../repositories/user.repository';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.toEntity(user) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? this.toEntity(user) : null;
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    return user ? this.toEntity(user) : null;
  }

  async createWithWallet(
    data: CreateUserWithWalletData,
  ): Promise<UserWithWalletEntity> {
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          username: data.username,
          passwordHash: data.passwordHash,
          wallet: {
            create: {
              currency: data.currency ?? 'NGN',
            },
          },
        },
        include: { wallet: true },
      });

      if (!user.wallet) {
        throw new Error('Wallet was not created with user');
      }

      return { user, walletId: user.wallet.id };
    });

    return {
      user: this.toEntity(result.user),
      walletId: result.walletId,
    };
  }

  private toEntity(user: PrismaUser): UserEntity {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
