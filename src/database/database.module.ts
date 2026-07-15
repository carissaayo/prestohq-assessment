import { Module } from '@nestjs/common';

import { PrismaTransferRepository } from './prisma/prisma-transfer.repository';
import { PrismaUserRepository } from './prisma/prisma-user.repository';
import { PrismaWalletRepository } from './prisma/prisma-wallet.repository';
import { PrismaWalletTransactionRepository } from './prisma/prisma-wallet-transaction.repository';
import { PrismaWebhookEventRepository } from './prisma/prisma-webhook-event.repository';
import { TransferRepository } from './repositories/transfer.repository';
import { UserRepository } from './repositories/user.repository';
import { WalletRepository } from './repositories/wallet.repository';
import { WalletTransactionRepository } from './repositories/wallet-transaction.repository';
import { WebhookEventRepository } from './repositories/webhook-event.repository';

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
    { provide: TransferRepository, useClass: PrismaTransferRepository },
    { provide: WebhookEventRepository, useClass: PrismaWebhookEventRepository },
  ],
  exports: [
    UserRepository,
    WalletRepository,
    WalletTransactionRepository,
    TransferRepository,
    WebhookEventRepository,
  ],
})
export class DatabaseModule {}
