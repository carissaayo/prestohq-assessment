import { Injectable } from '@nestjs/common';

import { customError } from '../../../common/exceptions/custom-error';
import type { ServiceResponseData } from '../../../common/handlers/response-handler';
import { AppLogger, ContextLogger } from '../../../core/logger';
import { UserRepository } from '../../../database/repositories/user.repository';
import { WalletRepository } from '../../../database/repositories/wallet.repository';
import { LoginDto } from '../dto/login.dto';
import { AuthCredentialService } from './auth-credential.service';
import { AuthTokenService } from './auth-token.service';

@Injectable()
export class AuthLoginService {
  private readonly log: ContextLogger;

  constructor(
    private readonly users: UserRepository,
    private readonly wallets: WalletRepository,
    private readonly tokens: AuthTokenService,
    private readonly credentials: AuthCredentialService,
    appLogger: AppLogger,
  ) {
    this.log = appLogger.createContext(AuthLoginService.name);
  }

  async login(dto: LoginDto): Promise<ServiceResponseData> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    if (!user) {
      throw customError.unauthorized('Invalid credentials');
    }

    await this.credentials.verifyPasswordOrThrow(
      user,
      dto.password,
      'Invalid credentials',
    );

    const wallet = await this.wallets.findByUserId(user.id);
    if (!wallet) {
      throw customError.internalServerError('Wallet missing for user');
    }

    this.log.action('User logged in', { userId: user.id });

    return {
      message: 'Login successful',
      accessToken: this.tokens.signAccessToken(user),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        walletId: wallet.id,
        hasPin: Boolean(user.pinHash),
      },
    };
  }
}
