import { Injectable } from '@nestjs/common';

import { customError } from '../../../common/exceptions/custom-error';
import type { ServiceResponseData } from '../../../common/handlers/response-handler';
import type { JwtPayloadUser } from '../../../core/security/decorators/current-user.decorator';
import { UserRepository } from '../../../database/repositories/user.repository';
import { WalletRepository } from '../../../database/repositories/wallet.repository';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthLoginService } from './auth-login.service';
import { AuthRegisterService } from './auth-register.service';

/** Facade — controllers inject this only. */
@Injectable()
export class AuthService {
  constructor(
    private readonly registerService: AuthRegisterService,
    private readonly loginService: AuthLoginService,
    private readonly users: UserRepository,
    private readonly wallets: WalletRepository,
  ) {}

  register(dto: RegisterDto): Promise<ServiceResponseData> {
    return this.registerService.register(dto);
  }

  login(dto: LoginDto): Promise<ServiceResponseData> {
    return this.loginService.login(dto);
  }

  async me(actor: JwtPayloadUser): Promise<ServiceResponseData> {
    const user = await this.users.findById(actor.userId);
    if (!user) {
      throw customError.unauthorized('User not found');
    }

    const wallet = await this.wallets.findByUserId(user.id);
    if (!wallet) {
      throw customError.internalServerError('Wallet missing for user');
    }

    return {
      message: 'Current user retrieved successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        walletId: wallet.id,
      },
    };
  }
}
