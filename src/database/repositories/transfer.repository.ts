export type TransferStatusValue =
  | 'INITIATED'
  | 'PENDING'
  | 'SUCCESSFUL'
  | 'FAILED';

export interface TransferEntity {
  id: string;
  userId: string;
  walletId: string;
  amount: number;
  currency: string;
  status: TransferStatusValue;
  flutterwaveTxRef: string;
  flutterwaveId: string | null;
  checkoutUrl: string | null;
  idempotencyKey: string;
  requestBodyHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTransferData {
  userId: string;
  walletId: string;
  amount: number;
  currency?: string;
  flutterwaveTxRef: string;
  idempotencyKey: string;
  requestBodyHash: string;
  status?: TransferStatusValue;
}

export interface UpdateTransferData {
  status?: TransferStatusValue;
  flutterwaveId?: string | null;
  checkoutUrl?: string | null;
}

export abstract class TransferRepository {
  abstract findById(id: string): Promise<TransferEntity | null>;
  abstract findByUserAndIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<TransferEntity | null>;
  abstract findByFlutterwaveTxRef(
    txRef: string,
  ): Promise<TransferEntity | null>;
  abstract create(data: CreateTransferData): Promise<TransferEntity>;
  abstract update(
    id: string,
    data: UpdateTransferData,
  ): Promise<TransferEntity>;
}
