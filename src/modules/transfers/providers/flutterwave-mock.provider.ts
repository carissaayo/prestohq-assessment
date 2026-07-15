import { Injectable } from '@nestjs/common';

import type {
  IFlutterwaveProvider,
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentResult,
} from './flutterwave.interface';

/**
 * Local/dev provider when FLUTTERWAVE_MOCK=true.
 * initiate returns a fake checkout URL; verify treats tx_ref as successful.
 */
@Injectable()
export class FlutterwaveMockProvider implements IFlutterwaveProvider {
  async initiatePayment(
    params: InitiatePaymentParams,
  ): Promise<InitiatePaymentResult> {
    return {
      checkoutUrl: `https://checkout.flutterwave.com/mock?tx_ref=${encodeURIComponent(params.txRef)}`,
      providerPaymentId: `mock-${params.txRef}`,
    };
  }

  async verifyByTxRef(txRef: string): Promise<VerifyPaymentResult> {
    // Encode amount in tx_ref suffix when tests use fund_<amount>_<id> — otherwise 0.
    // Production processor always re-checks transfer.amount against local record.
    return {
      status: 'successful',
      amountKobo: 0,
      currency: 'NGN',
      txRef,
      providerTransactionId: `mock-txn-${txRef}`,
    };
  }

  verifyWebhookSignature(verifHashHeader: string | undefined): boolean {
    return verifHashHeader === 'mock-webhook-secret';
  }
}
