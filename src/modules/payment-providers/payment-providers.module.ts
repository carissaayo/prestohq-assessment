import { Module } from '@nestjs/common';

import { FlutterwavePaymentModule } from './flutterwave/flutterwave-payment.module';

@Module({
  imports: [FlutterwavePaymentModule],
  exports: [FlutterwavePaymentModule],
})
export class PaymentProvidersModule {}
