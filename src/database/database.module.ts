import { Module } from '@nestjs/common';

import { PrismaUserRepository } from './prisma/prisma-user.repository';
import { PrismaWalletRepository } from './prisma/prisma-wallet.repository';
import { PrismaWalletTransactionRepository } from './prisma/prisma-wallet-transaction.repository';
import { UserRepository } from './repositories/user.repository';
import { WalletRepository } from './repositories/wallet.repository';
import { WalletTransactionRepository } from './repositories/wallet-transaction.repository';

/**
 * Binds abstract repositories to Prisma implementations.
 * Services inject the abstract classes only.
 */
@Module({
  providers: [
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: WalletRepository, useClass: PrismaWalletRepository },
    {
      provide: WalletTransactionRepository,
      useClass: PrismaWalletTransactionRepository,
    },
  ],
  exports: [UserRepository, WalletRepository, WalletTransactionRepository],
})
export class DatabaseModule {}
