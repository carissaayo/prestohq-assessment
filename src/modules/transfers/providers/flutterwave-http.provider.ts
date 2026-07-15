import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

import { customError } from '../../../common/exceptions/custom-error';
import { AppLogger, ContextLogger } from '../../../core/logger';
import { koboToNaira, nairaToKobo } from '../../../common/utils/money';
import type {
  IFlutterwaveProvider,
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyPaymentResult,
} from './flutterwave.interface';

const FLW_BASE = 'https://api.flutterwave.com/v3';

@Injectable()
export class FlutterwaveHttpProvider implements IFlutterwaveProvider {
  private readonly log: ContextLogger;

  constructor(
    private readonly config: ConfigService,
    appLogger: AppLogger,
  ) {
    this.log = appLogger.createContext(FlutterwaveHttpProvider.name);
  }

  async initiatePayment(
    params: InitiatePaymentParams,
  ): Promise<InitiatePaymentResult> {
    const secret = this.requireSecret();
    const amount = koboToNaira(params.amountKobo);

    const response = await fetch(`${FLW_BASE}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: params.txRef,
        amount,
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
      }),
    });

    const body = (await response.json()) as {
      status?: string;
      message?: string;
      data?: { link?: string; id?: number | string };
    };

    if (!response.ok || body.status !== 'success' || !body.data?.link) {
      this.log.warn('Flutterwave initiate failed', {
        status: response.status,
        message: body.message,
      });
      throw customError.badGateway(
        body.message ?? 'Failed to initiate Flutterwave payment',
      );
    }

    return {
      checkoutUrl: body.data.link,
      providerPaymentId: body.data.id?.toString(),
    };
  }

  async verifyByTxRef(txRef: string): Promise<VerifyPaymentResult> {
    const secret = this.requireSecret();
    const url = `${FLW_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
    });

    const body = (await response.json()) as {
      status?: string;
      message?: string;
      data?: {
        status?: string;
        amount?: number;
        currency?: string;
        tx_ref?: string;
        id?: number | string;
      };
    };

    if (!response.ok || body.status !== 'success' || !body.data) {
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
  }

  verifyWebhookSignature(verifHashHeader: string | undefined): boolean {
    const secret =
      this.config.get<string>('flutterwave.webhookSecret') ||
      this.config.get<string>('flutterwave.secretKey');
    if (!secret || !verifHashHeader) {
      return false;
    }

    const a = Buffer.from(secret);
    const b = Buffer.from(verifHashHeader);
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  }

  private requireSecret(): string {
    const secret = this.config.get<string>('flutterwave.secretKey');
    if (!secret) {
      throw customError.serviceUnavailable(
        'Flutterwave is not configured (FLUTTERWAVE_SECRET_KEY)',
      );
    }
    return secret;
  }
}
