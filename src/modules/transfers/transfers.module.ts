import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseModule } from '../../database/database.module';
import { WalletsModule } from '../wallets/wallets.module';
import { FlutterwaveWebhookController } from './controllers/flutterwave-webhook.controller';
import { TransfersController } from './controllers/transfers.controller';
import { TransferCompleteProcessor } from './processors/transfer-complete.processor';
import { FlutterwaveHttpProvider } from './providers/flutterwave-http.provider';
import {
  FLUTTERWAVE_PROVIDER,
  type IFlutterwaveProvider,
} from './providers/flutterwave.interface';
import { FlutterwaveMockProvider } from './providers/flutterwave-mock.provider';
import { TransferCompleteService } from './services/transfer-complete.service';
import { TransferCreateService } from './services/transfer-create.service';
import { TransferWebhookService } from './services/transfer-webhook.service';
import { TransfersService } from './services/transfers.service';

@Module({
  imports: [DatabaseModule, WalletsModule],
  controllers: [TransfersController, FlutterwaveWebhookController],
  providers: [
    TransfersService,
    TransferCreateService,
    TransferWebhookService,
    TransferCompleteService,
    TransferCompleteProcessor,
    FlutterwaveHttpProvider,
    FlutterwaveMockProvider,
    {
      provide: FLUTTERWAVE_PROVIDER,
      inject: [ConfigService, FlutterwaveHttpProvider, FlutterwaveMockProvider],
      useFactory: (
        config: ConfigService,
        http: FlutterwaveHttpProvider,
        mock: FlutterwaveMockProvider,
      ): IFlutterwaveProvider => {
        const useMock =
          config.get<string>('flutterwave.mock') === 'true' ||
          !config.get<string>('flutterwave.secretKey');
        return useMock ? mock : http;
      },
    },
  ],
  exports: [TransfersService],
})
export class TransfersModule {}
