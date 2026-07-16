import { Injectable } from '@nestjs/common';
import type { User as PrismaUser } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateUserData,
  CreateUserWithWalletResult,
  UserEntity,
  UserRepository,
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
    data: CreateUserData,
  ): Promise<CreateUserWithWalletResult> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
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

    return {
      user: this.toEntity(user),
      walletId: user.wallet.id,
    };
  }

  async recordPasswordFailure(
    id: string,
    attempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordTryCount: attempts,
        passwordLockedUntil: lockedUntil,
      },
    });
  }

  async resetPasswordFailures(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordTryCount: 0,
        passwordLockedUntil: null,
      },
    });
  }

  async setPinHash(id: string, pinHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        pinHash,
        pinTryCount: 0,
        pinLockedUntil: null,
      },
    });
  }

  async recordPinFailure(
    id: string,
    attempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        pinTryCount: attempts,
        pinLockedUntil: lockedUntil,
      },
    });
  }

  async resetPinFailures(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        pinTryCount: 0,
        pinLockedUntil: null,
      },
    });
  }

  private toEntity(user: PrismaUser): UserEntity {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      passwordHash: user.passwordHash,
      passwordTryCount: user.passwordTryCount,
      passwordLockedUntil: user.passwordLockedUntil,
      pinHash: user.pinHash,
      pinTryCount: user.pinTryCount,
      pinLockedUntil: user.pinLockedUntil,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
