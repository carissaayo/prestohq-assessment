export type WalletStatusValue = 'ACTIVE' | 'LOCKED';

export interface WalletEntity {
  id: string;
  userId: string;
  currency: string;
  status: WalletStatusValue;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class WalletRepository {
  abstract findById(id: string): Promise<WalletEntity | null>;
  abstract findByUserId(userId: string): Promise<WalletEntity | null>;
}
