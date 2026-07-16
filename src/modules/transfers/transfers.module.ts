import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { WalletsModule } from '../wallets/wallets.module';
import { FlutterwaveWebhookController } from './controllers/flutterwave-webhook.controller';
import { FundingCallbackController } from './controllers/funding-callback.controller';
import { TransfersController } from './controllers/transfers.controller';
import { TransferCompleteProcessor } from './processors/transfer-complete.processor';
import { TransferCompleteService } from './services/transfer-complete.service';
import { TransferCreateService } from './services/transfer-create.service';
import { TransferWebhookService } from './services/transfer-webhook.service';
import { TransfersService } from './services/transfers.service';

@Module({
  imports: [DatabaseModule, WalletsModule, AuthModule, PaymentProvidersModule],
  controllers: [
    TransfersController,
    FlutterwaveWebhookController,
    FundingCallbackController,
  ],
  providers: [
    TransfersService,
    TransferCreateService,
    TransferWebhookService,
    TransferCompleteService,
    TransferCompleteProcessor,
  ],
  exports: [TransfersService],
})
export class TransfersModule {}
