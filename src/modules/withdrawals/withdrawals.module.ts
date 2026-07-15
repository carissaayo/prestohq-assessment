import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { WithdrawalsController } from './controllers/withdrawals.controller';
import { WithdrawalP2pService } from './services/withdrawal-p2p.service';
import { WithdrawalsService } from './services/withdrawals.service';

@Module({
  imports: [DatabaseModule],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService, WithdrawalP2pService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
