import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { FlutterwaveApiService } from '../../../common/services-external/flutterwave/flutterwave-api.service';
import { LoggerModule } from '../../../core/logger/logger.module';
import { FlutterwaveMockAdapter } from './flutterwave-mock.adapter';
import {
  FLUTTERWAVE_PROVIDER,
  type IFlutterwaveProvider,
} from './flutterwave-payment.interface';
import { FlutterwavePaymentService } from './flutterwave-payment.service';

@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [
    FlutterwaveApiService,
    FlutterwavePaymentService,
    FlutterwaveMockAdapter,
    {
      provide: FLUTTERWAVE_PROVIDER,
      inject: [
        ConfigService,
        FlutterwavePaymentService,
        FlutterwaveMockAdapter,
      ],
      useFactory: (
        config: ConfigService,
        real: FlutterwavePaymentService,
        mock: FlutterwaveMockAdapter,
      ): IFlutterwaveProvider => {
        const useMock =
          config.get<string>('flutterwave.mock') === 'true' ||
          !config.get<string>('flutterwave.secretKey');
        return useMock ? mock : real;
      },
    },
  ],
  exports: [FLUTTERWAVE_PROVIDER, FlutterwavePaymentService],
})
export class FlutterwavePaymentModule {}
