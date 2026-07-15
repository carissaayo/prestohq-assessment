import { Module } from '@nestjs/common';

import { PrismaUserRepository } from './prisma/prisma-user.repository';
import { PrismaWalletRepository } from './prisma/prisma-wallet.repository';
import { UserRepository } from './repositories/user.repository';
import { WalletRepository } from './repositories/wallet.repository';

/**
 * Binds abstract repositories to Prisma implementations.
 * Services inject the abstract classes only.
 */
@Module({
  providers: [
    { provide: UserRepository, useClass: PrismaUserRepository },
    { provide: WalletRepository, useClass: PrismaWalletRepository },
  ],
  exports: [UserRepository, WalletRepository],
})
export class DatabaseModule {}
