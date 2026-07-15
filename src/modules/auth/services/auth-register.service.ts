import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { customError } from '../../../common/exceptions/custom-error';
import type { ServiceResponseData } from '../../../common/handlers/response-handler';
import { AppLogger, ContextLogger } from '../../../core/logger';
import { UserRepository } from '../../../database/repositories/user.repository';
import { RegisterDto } from '../dto/register.dto';
import { AuthTokenService } from './auth-token.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthRegisterService {
  private readonly log: ContextLogger;

  constructor(
    private readonly users: UserRepository,
    private readonly tokens: AuthTokenService,
    appLogger: AppLogger,
  ) {
    this.log = appLogger.createContext(AuthRegisterService.name);
  }

  async register(dto: RegisterDto): Promise<ServiceResponseData> {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();

    if (await this.users.findByEmail(email)) {
      throw customError.conflict('Email is already registered');
    }

    if (await this.users.findByUsername(username)) {
      throw customError.conflict('Username is already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const created = await this.users.createWithWallet({
      email,
      username,
      passwordHash,
    });

    this.log.action('User registered', {
      userId: created.user.id,
      walletId: created.walletId,
    });

    const accessToken = this.tokens.signAccessToken(created.user);

    return {
      message: 'Account created successfully',
      accessToken,
      user: {
        id: created.user.id,
        email: created.user.email,
        username: created.user.username,
        walletId: created.walletId,
      },
    };
  }
}
