import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

import {
  FlutterwaveApiError,
  type FlwPaymentInitRequest,
  type FlwPaymentInitResponse,
  type FlwTransferInitRequest,
  type FlwTransferInitResponse,
  type FlwTransferStatusResponse,
  type FlwVerifyByRefResponse,
} from './flutterwave-api.types';

const FLW_BASE = 'https://api.flutterwave.com/v3';

/**
 * Raw Flutterwave v3 HTTP client. No Nest business-error mapping —
 * callers convert failures into domain errors.
 */
@Injectable()
export class FlutterwaveApiService {
  constructor(private readonly config: ConfigService) {}

  async initiatePayment(
    body: FlwPaymentInitRequest,
  ): Promise<FlwPaymentInitResponse> {
    const secret = this.requireSecret();
    const response = await fetch(`${FLW_BASE}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = (await response.json()) as FlwPaymentInitResponse;
    if (!response.ok || json.status !== 'success' || !json.data?.link) {
      throw new FlutterwaveApiError(
        json.message ?? 'Failed to initiate Flutterwave payment',
        response.status,
        json.status,
      );
    }
    return json;
  }

  async verifyTransactionByReference(
    txRef: string,
  ): Promise<FlwVerifyByRefResponse> {
    const secret = this.requireSecret();
    const url = `${FLW_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    return (await response.json()) as FlwVerifyByRefResponse;
  }

  async initiateTransfer(
    body: FlwTransferInitRequest,
  ): Promise<{ ok: boolean; httpStatus: number; body: FlwTransferInitResponse }> {
    const secret = this.requireSecret();
    const response = await fetch(`${FLW_BASE}/transfers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = (await response.json()) as FlwTransferInitResponse;
    return { ok: response.ok, httpStatus: response.status, body: json };
  }

  async getTransfer(
    transferId: string,
  ): Promise<{ ok: boolean; body: FlwTransferStatusResponse }> {
    const secret = this.requireSecret();
    const response = await fetch(`${FLW_BASE}/transfers/${transferId}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json = (await response.json()) as FlwTransferStatusResponse;
    return { ok: response.ok, body: json };
  }

  verifyWebhookHash(verifHashHeader: string | undefined): boolean {
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
      throw new FlutterwaveApiError(
        'Flutterwave is not configured (FLUTTERWAVE_SECRET_KEY)',
      );
    }
    return secret;
  }
}
