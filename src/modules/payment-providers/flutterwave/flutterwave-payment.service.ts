import { Injectable } from '@nestjs/common';

import { customError } from '../../../common/exceptions/custom-error';
import { FlutterwaveApiService } from '../../../common/services-external/flutterwave/flutterwave-api.service';
import { FlutterwaveApiError } from '../../../common/services-external/flutterwave/flutterwave-api.types';
import { koboToNaira, nairaToKobo } from '../../../common/utils/money';
import { AppLogger, ContextLogger } from '../../../core/logger';
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
 * Nest-facing Flutterwave provider — consumes FlutterwaveApiService,
 * maps amounts (kobo ↔ naira) and errors into domain exceptions.
 */
@Injectable()
export class FlutterwavePaymentService implements IFlutterwaveProvider {
  private readonly log: ContextLogger;

  constructor(
    private readonly api: FlutterwaveApiService,
    appLogger: AppLogger,
  ) {
    this.log = appLogger.createContext(FlutterwavePaymentService.name);
  }

  async initiatePayment(
    params: InitiatePaymentParams,
  ): Promise<InitiatePaymentResult> {
    try {
      const body = await this.api.initiatePayment({
        tx_ref: params.txRef,
        amount: koboToNaira(params.amountKobo),
        currency: params.currency,
        redirect_url: params.redirectUrl,
        customer: {
          email: params.customer.email,
          name: params.customer.name,
        },
        customizations: {
          title: 'Wallet funding',
          description: 'Fund your wallet',
        },
      });

      return {
        checkoutUrl: body.data!.link!,
        providerPaymentId: body.data!.id?.toString(),
      };
    } catch (err) {
      if (err instanceof FlutterwaveApiError) {
        this.log.warn('Flutterwave initiate failed', {
          message: err.message,
          httpStatus: err.httpStatus,
        });
        if (err.message.includes('FLUTTERWAVE_SECRET_KEY')) {
          throw customError.serviceUnavailable(err.message);
        }
        throw customError.badGateway(err.message);
      }
      throw err;
    }
  }

  async verifyByTxRef(txRef: string): Promise<VerifyPaymentResult> {
    try {
      const body = await this.api.verifyTransactionByReference(txRef);
      if (body.status !== 'success' || !body.data) {
        this.log.warn('Flutterwave verify failed', {
          txRef,
          message: body.message,
        });
        return {
          status: 'unknown',
          amountKobo: 0,
          currency: 'NGN',
          txRef,
        };
      }

      const flwStatus = (body.data.status ?? '').toLowerCase();
      let status: VerifyPaymentResult['status'] = 'unknown';
      if (flwStatus === 'successful') status = 'successful';
      else if (flwStatus === 'failed') status = 'failed';
      else if (flwStatus === 'pending') status = 'pending';

      return {
        status,
        amountKobo: nairaToKobo(Number(body.data.amount ?? 0)),
        currency: body.data.currency ?? 'NGN',
        txRef: body.data.tx_ref ?? txRef,
        providerTransactionId: body.data.id?.toString(),
      };
    } catch (err) {
      if (err instanceof FlutterwaveApiError) {
        this.log.warn('Flutterwave verify error', { txRef, message: err.message });
        return {
          status: 'unknown',
          amountKobo: 0,
          currency: 'NGN',
          txRef,
        };
      }
      throw err;
    }
  }

  verifyWebhookSignature(verifHashHeader: string | undefined): boolean {
    return this.api.verifyWebhookHash(verifHashHeader);
  }

  async initiateBankTransfer(
    params: InitiateBankTransferParams,
  ): Promise<InitiateBankTransferResult> {
    try {
      const { ok, body } = await this.api.initiateTransfer({
        account_bank: params.bankCode,
        account_number: params.accountNumber,
        amount: koboToNaira(params.amountKobo),
        currency: params.currency,
        narration: params.narration,
        reference: params.reference,
      });

      if (!ok || body.status !== 'success' || !body.data) {
        this.log.warn('Flutterwave bank transfer initiate failed', {
          message: body.message,
        });
        return {
          status: 'FAILED',
          message: body.message ?? 'Bank transfer initiation failed',
        };
      }

      const flwStatus = (body.data.status ?? '').toLowerCase();
      let status: InitiateBankTransferResult['status'] = 'PENDING';
      if (flwStatus === 'successful' || flwStatus === 'success') {
        status = 'SUCCESSFUL';
      } else if (flwStatus === 'failed') {
        status = 'FAILED';
      }

      return {
        status,
        transferId: body.data.id?.toString(),
        message: body.message,
      };
    } catch (err) {
      if (err instanceof FlutterwaveApiError) {
        this.log.warn('Flutterwave bank transfer error', {
          message: err.message,
        });
        return { status: 'FAILED', message: err.message };
      }
      throw err;
    }
  }

  async getBankTransferStatus(
    transferId: string,
  ): Promise<BankTransferStatusResult> {
    try {
      const { ok, body } = await this.api.getTransfer(transferId);
      if (!ok || body.status !== 'success' || !body.data) {
        return {
          status: 'UNKNOWN',
          transferId,
          message: body.message,
        };
      }

      const flwStatus = (body.data.status ?? '').toLowerCase();
      let status: BankTransferStatusResult['status'] = 'UNKNOWN';
      if (flwStatus === 'successful' || flwStatus === 'success') {
        status = 'SUCCESSFUL';
      } else if (flwStatus === 'failed') {
        status = 'FAILED';
      } else if (flwStatus === 'pending' || flwStatus === 'new') {
        status = 'PENDING';
      }

      return {
        status,
        transferId: body.data.id?.toString() ?? transferId,
        message: body.message,
      };
    } catch (err) {
      if (err instanceof FlutterwaveApiError) {
        return {
          status: 'UNKNOWN',
          transferId,
          message: err.message,
        };
      }
      throw err;
    }
  }
}
