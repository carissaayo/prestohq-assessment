import { Injectable } from '@nestjs/common';

import type {
  BankTransferStatusResult,
  IFlutterwaveProvider,
  InitiateBankTransferParams,
  InitiateBankTransferResult,
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentResult,
} from './flutterwave-payment.interface';

/**
 * Local/dev adapter when FLUTTERWAVE_MOCK=true.
 *
 * Bank transfer mock switches (accountNumber):
 * - ends with `000` → initiate FAILED
 * - ends with `999` → initiate PENDING, settle FAILED
 * - otherwise → initiate SUCCESSFUL
 */
@Injectable()
export class FlutterwaveMockAdapter implements IFlutterwaveProvider {
  async initiatePayment(
    params: InitiatePaymentParams,
  ): Promise<InitiatePaymentResult> {
    return {
      checkoutUrl: `https://checkout.flutterwave.com/mock?tx_ref=${encodeURIComponent(params.txRef)}`,
      providerPaymentId: `mock-${params.txRef}`,
    };
  }

  async verifyByTxRef(txRef: string): Promise<VerifyPaymentResult> {
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

  async initiateBankTransfer(
    params: InitiateBankTransferParams,
  ): Promise<InitiateBankTransferResult> {
    const acct = params.accountNumber;
    if (acct.endsWith('000')) {
      return { status: 'FAILED', message: 'Mock initiate failure' };
    }
    if (acct.endsWith('999')) {
      return {
        status: 'PENDING',
        transferId: `mock-xfer-fail-${params.reference}`,
        message: 'Mock pending — will fail on settle',
      };
    }
    return {
      status: 'SUCCESSFUL',
      transferId: `mock-xfer-ok-${params.reference}`,
      message: 'Mock bank transfer successful',
    };
  }

  async getBankTransferStatus(
    transferId: string,
  ): Promise<BankTransferStatusResult> {
    if (transferId.includes('fail')) {
      return {
        status: 'FAILED',
        transferId,
        message: 'Mock settle failure',
      };
    }
    return {
      status: 'SUCCESSFUL',
      transferId,
      message: 'Mock settle successful',
    };
  }
}
