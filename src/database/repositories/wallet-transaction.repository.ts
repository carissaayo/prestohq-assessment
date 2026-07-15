export type WalletTxType = 'CREDIT' | 'DEBIT';
export type WalletTxPurpose =
  | 'FLUTTERWAVE_FUNDING'
  | 'P2P'
  | 'BANK_PAYOUT'
  | 'REVERSAL';
export type WalletTxStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED';

export interface WalletTransactionEntity {
  id: string;
  walletId: string;
  type: WalletTxType;
  purpose: WalletTxPurpose;
  status: WalletTxStatus;
  amount: number;
  idempotencyKey: string;
  reference: string | null;
  counterpartWalletId: string | null;
  transferId: string | null;
  withdrawalId: string | null;
  reversesTransactionId: string | null;
  createdAt: Date;
}

export interface CreateWalletTransactionData {
  walletId: string;
  type: WalletTxType;
  purpose: WalletTxPurpose;
  status: WalletTxStatus;
  amount: number;
  idempotencyKey: string;
  reference?: string | null;
  counterpartWalletId?: string | null;
  transferId?: string | null;
  withdrawalId?: string | null;
  reversesTransactionId?: string | null;
}

export interface ListWalletTransactionsParams {
  walletId: string;
  limit?: number;
  cursor?: string;
}

export interface ListWalletTransactionsResult {
  items: WalletTransactionEntity[];
  nextCursor: string | null;
}

/**
 * Transaction-scoped ledger ops (Option A: FOR UPDATE + fresh SUM).
 * Obtained only via `WalletTransactionRepository.withTransaction`.
 */
export interface LedgerTxOps {
  lockWallet(walletId: string): Promise<void>;
  getSuccessfulBalance(walletId: string): Promise<number>;
  insert(
    data: CreateWalletTransactionData,
  ): Promise<WalletTransactionEntity>;
  findById(id: string): Promise<WalletTransactionEntity | null>;
  findByIdempotencyKey(
    key: string,
  ): Promise<WalletTransactionEntity | null>;
  updateStatus(
    id: string,
    status: WalletTxStatus,
  ): Promise<WalletTransactionEntity>;
}

export abstract class WalletTransactionRepository {
  abstract getSuccessfulBalance(walletId: string): Promise<number>;

  abstract findById(id: string): Promise<WalletTransactionEntity | null>;

  abstract findByIdempotencyKey(
    key: string,
  ): Promise<WalletTransactionEntity | null>;

  abstract findByTransferId(
    transferId: string,
  ): Promise<WalletTransactionEntity[]>;

  abstract listByWalletId(
    params: ListWalletTransactionsParams,
  ): Promise<ListWalletTransactionsResult>;

  abstract withTransaction<T>(
    fn: (ops: LedgerTxOps) => Promise<T>,
  ): Promise<T>;
}
