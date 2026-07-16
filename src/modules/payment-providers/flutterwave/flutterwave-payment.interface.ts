export interface FlutterwaveCustomer {
  email: string;
  name: string;
}

export interface InitiatePaymentParams {
  txRef: string;
  amountKobo: number;
  currency: string;
  customer: FlutterwaveCustomer;
  redirectUrl: string;
}

export interface InitiatePaymentResult {
  checkoutUrl: string;
  providerPaymentId?: string;
}

export interface VerifyPaymentResult {
  status: 'successful' | 'failed' | 'pending' | 'unknown';
  amountKobo: number;
  currency: string;
  txRef: string;
  providerTransactionId?: string;
}

export interface InitiateBankTransferParams {
  reference: string;
  amountKobo: number;
  currency: string;
  bankCode: string;
  accountNumber: string;
  narration: string;
}

export interface InitiateBankTransferResult {
  status: 'SUCCESSFUL' | 'PENDING' | 'FAILED';
  transferId?: string;
  message?: string;
}

export interface BankTransferStatusResult {
  status: 'SUCCESSFUL' | 'PENDING' | 'FAILED' | 'UNKNOWN';
  transferId?: string;
  message?: string;
}

export const FLUTTERWAVE_PROVIDER = Symbol('FLUTTERWAVE_PROVIDER');

export interface IFlutterwaveProvider {
  initiatePayment(
    params: InitiatePaymentParams,
  ): Promise<InitiatePaymentResult>;
  verifyByTxRef(txRef: string): Promise<VerifyPaymentResult>;
  verifyWebhookSignature(verifHashHeader: string | undefined): boolean;
  initiateBankTransfer(
    params: InitiateBankTransferParams,
  ): Promise<InitiateBankTransferResult>;
  getBankTransferStatus(
    transferId: string,
  ): Promise<BankTransferStatusResult>;
}
