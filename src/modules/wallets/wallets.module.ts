import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { WalletsController } from './controllers/wallets.controller';
import { WalletLedgerCreditService } from './services/wallet-ledger-credit.service';
import { WalletLedgerDebitService } from './services/wallet-ledger-debit.service';
import { WalletLedgerService } from './services/wallet-ledger.service';
import { WalletsService } from './services/wallets.service';

@Module({
  imports: [DatabaseModule],
  controllers: [WalletsController],
  providers: [
    WalletsService,
    WalletLedgerService,
    WalletLedgerCreditService,
    WalletLedgerDebitService,
  ],
  exports: [WalletLedgerService, WalletsService],
})
export class WalletsModule {}
