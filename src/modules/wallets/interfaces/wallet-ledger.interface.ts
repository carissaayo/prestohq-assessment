import type {
  WalletTransactionEntity,
  WalletTxPurpose,
} from '../../../database/repositories/wallet-transaction.repository';

export interface PostCreditPendingInput {
  walletId: string;
  amount: number;
  purpose: Extract<WalletTxPurpose, 'FLUTTERWAVE_FUNDING'>;
  idempotencyKey: string;
  reference?: string;
  transferId?: string;
}

export interface CompleteCreditInput {
  transactionId: string;
  expectedWalletId: string;
}

export interface PostDebitInput {
  walletId: string;
  amount: number;
  purpose: Extract<WalletTxPurpose, 'P2P' | 'BANK_PAYOUT'>;
  idempotencyKey: string;
  reference?: string;
  counterpartWalletId?: string;
  withdrawalId?: string;
}

export interface PostReversalInput {
  walletId: string;
  amount: number;
  originalDebitId: string;
  idempotencyKey: string;
  withdrawalId?: string;
  reference?: string;
}

export interface LedgerWriteResult {
  transaction: WalletTransactionEntity;
  /** True when a new row was created; false on idempotent replay. */
  created: boolean;
  balanceAfter?: number;
}
