import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { TransfersModule } from '../transfers/transfers.module';
import { WalletsModule } from '../wallets/wallets.module';
import { WithdrawalsController } from './controllers/withdrawals.controller';
import { WithdrawalPayoutProcessor } from './processors/withdrawal-payout.processor';
import { WithdrawalSettleProcessor } from './processors/withdrawal-settle.processor';
import { WithdrawalBankService } from './services/withdrawal-bank.service';
import { WithdrawalP2pService } from './services/withdrawal-p2p.service';
import { WithdrawalPayoutService } from './services/withdrawal-payout.service';
import { WithdrawalSettleService } from './services/withdrawal-settle.service';
import { WithdrawalsService } from './services/withdrawals.service';

@Module({
  imports: [DatabaseModule, WalletsModule, TransfersModule],
  controllers: [WithdrawalsController],
  providers: [
    WithdrawalsService,
    WithdrawalP2pService,
    WithdrawalBankService,
    WithdrawalPayoutService,
    WithdrawalSettleService,
    WithdrawalPayoutProcessor,
    WithdrawalSettleProcessor,
  ],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
