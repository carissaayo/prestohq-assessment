export interface UserEntity {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  passwordTryCount: number;
  passwordLockedUntil: Date | null;
  pinHash: string | null;
  pinTryCount: number;
  pinLockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  currency?: string;
}

export interface CreateUserWithWalletResult {
  user: UserEntity;
  walletId: string;
}

/**
 * Abstract user repository — inject this token, never PrismaUserRepository.
 */
export abstract class UserRepository {
  abstract findById(id: string): Promise<UserEntity | null>;
  abstract findByEmail(email: string): Promise<UserEntity | null>;
  abstract findByUsername(username: string): Promise<UserEntity | null>;
  abstract createWithWallet(
    data: CreateUserData,
  ): Promise<CreateUserWithWalletResult>;
  abstract recordPasswordFailure(
    id: string,
    attempts: number,
    lockedUntil: Date | null,
  ): Promise<void>;
  abstract resetPasswordFailures(id: string): Promise<void>;
  abstract setPinHash(id: string, pinHash: string): Promise<void>;
  abstract recordPinFailure(
    id: string,
    attempts: number,
    lockedUntil: Date | null,
  ): Promise<void>;
  abstract resetPinFailures(id: string): Promise<void>;
}
