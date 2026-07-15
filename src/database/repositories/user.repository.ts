export interface UserEntity {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserWithWalletData {
  email: string;
  username: string;
  passwordHash: string;
  currency?: string;
}

export interface UserWithWalletEntity {
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
    data: CreateUserWithWalletData,
  ): Promise<UserWithWalletEntity>;
}
