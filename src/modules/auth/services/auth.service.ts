import { Injectable } from '@nestjs/common';

import { customError } from '../../../common/exceptions/custom-error';
import type { ServiceResponseData } from '../../../common/handlers/response-handler';
import type { JwtPayloadUser } from '../../../core/security/decorators/current-user.decorator';
import { UserRepository } from '../../../database/repositories/user.repository';
import { WalletRepository } from '../../../database/repositories/wallet.repository';
import { CreatePinDto } from '../dto/create-pin.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthCreatePinService } from './auth-create-pin.service';
import { AuthCredentialService } from './auth-credential.service';
import { AuthLoginService } from './auth-login.service';
import { AuthRegisterService } from './auth-register.service';

/** Facade — controllers inject this only. */
@Injectable()
export class AuthService {
  constructor(
    private readonly registerService: AuthRegisterService,
    private readonly loginService: AuthLoginService,
    private readonly createPinService: AuthCreatePinService,
    private readonly credentials: AuthCredentialService,
    private readonly users: UserRepository,
    private readonly wallets: WalletRepository,
  ) {}

  register(dto: RegisterDto): Promise<ServiceResponseData> {
    return this.registerService.register(dto);
  }

  login(dto: LoginDto): Promise<ServiceResponseData> {
    return this.loginService.login(dto);
  }

  createPin(
    actor: JwtPayloadUser,
    dto: CreatePinDto,
  ): Promise<ServiceResponseData> {
    return this.createPinService.create(actor, dto);
  }

  verifyPin(userId: string, pin: string): Promise<void> {
    return this.credentials.verifyPinOrThrow(userId, pin);
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
        firstName: user.firstName,
        lastName: user.lastName,
        walletId: wallet.id,
        hasPin: Boolean(user.pinHash),
      },
    };
  }
}
