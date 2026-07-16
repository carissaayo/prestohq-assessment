export type WithdrawalDestinationTypeValue = 'WALLET' | 'BANK';
export type WithdrawalStatusValue =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESSFUL'
  | 'FAILED'
  | 'REVERSED';

export interface WithdrawalEntity {
  id: string;
  userId: string;
  walletId: string;
  amount: number;
  currency: string;
  destinationType: WithdrawalDestinationTypeValue;
  destinationWalletId: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  accountName: string | null;
  status: WithdrawalStatusValue;
  providerReference: string | null;
  providerTransferId: string | null;
  debitTransactionId: string | null;
  creditTransactionId: string | null;
  reversalTransactionId: string | null;
  idempotencyKey: string;
  requestBodyHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecuteP2pWithdrawalData {
  userId: string;
  senderWalletId: string;
  destinationWalletId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  requestBodyHash: string;
}

export interface ExecuteP2pWithdrawalResult {
  withdrawal: WithdrawalEntity;
  created: boolean;
}

export interface ExecuteBankWithdrawalData {
  userId: string;
  walletId: string;
  amount: number;
  currency: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  providerReference: string;
  idempotencyKey: string;
  requestBodyHash: string;
}

export interface ExecuteBankWithdrawalResult {
  withdrawal: WithdrawalEntity;
  created: boolean;
}

export interface UpdateWithdrawalProviderData {
  status?: WithdrawalStatusValue;
  providerTransferId?: string | null;
  debitTransactionId?: string | null;
  creditTransactionId?: string | null;
  reversalTransactionId?: string | null;
}

export abstract class WithdrawalRepository {
  abstract findById(id: string): Promise<WithdrawalEntity | null>;

  abstract findByUserAndIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<WithdrawalEntity | null>;

  abstract findByProviderReference(
    providerReference: string,
  ): Promise<WithdrawalEntity | null>;

  abstract listByUserId(userId: string): Promise<WithdrawalEntity[]>;

  /**
   * Atomic P2P: lock wallets (asc id), SUM-check sender, debit+credit journals,
   * create SUCCESSFUL withdrawal — all one DB transaction.
   */
  abstract executeP2p(
    data: ExecuteP2pWithdrawalData,
  ): Promise<ExecuteP2pWithdrawalResult>;

  /**
   * Atomic bank accept: lock wallet, SUM-check, DEBIT SUCCESSFUL + Withdrawal PROCESSING.
   */
  abstract executeBankAccept(
    data: ExecuteBankWithdrawalData,
  ): Promise<ExecuteBankWithdrawalResult>;

  abstract update(
    id: string,
    data: UpdateWithdrawalProviderData,
  ): Promise<WithdrawalEntity>;
}
