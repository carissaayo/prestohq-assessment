/** Raw Flutterwave API request/response shapes (v3). */

export interface FlwPaymentInitRequest {
  tx_ref: string;
  amount: number;
  currency: string;
  redirect_url: string;
  customer: { email: string; name: string };
  customizations?: { title?: string; description?: string };
}

export interface FlwPaymentInitResponse {
  status?: string;
  message?: string;
  data?: { link?: string; id?: number | string };
}

export interface FlwVerifyByRefResponse {
  status?: string;
  message?: string;
  data?: {
    status?: string;
    amount?: number;
    currency?: string;
    tx_ref?: string;
    id?: number | string;
  };
}

export interface FlwTransferInitRequest {
  account_bank: string;
  account_number: string;
  amount: number;
  currency: string;
  narration: string;
  reference: string;
}

export interface FlwTransferInitResponse {
  status?: string;
  message?: string;
  data?: { id?: number | string; status?: string };
}

export interface FlwTransferStatusResponse {
  status?: string;
  message?: string;
  data?: { id?: number | string; status?: string };
}

export class FlutterwaveApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
    readonly flwStatus?: string,
  ) {
    super(message);
    this.name = 'FlutterwaveApiError';
  }
}
