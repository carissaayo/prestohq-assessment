import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { customError } from '../../../common/exceptions/custom-error';
import type { ServiceResponseData } from '../../../common/handlers/response-handler';
import { AppLogger, ContextLogger } from '../../../core/logger';
import { UserRepository } from '../../../database/repositories/user.repository';
import { BCRYPT_ROUNDS } from '../auth.constants';
import { RegisterDto } from '../dto/register.dto';
import { AuthTokenService } from './auth-token.service';

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
    if (dto.password !== dto.confirmPassword) {
      throw customError.badRequest('password and confirmPassword do not match');
    }

    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();

    if (!firstName || !lastName) {
      throw customError.badRequest('firstName and lastName are required');
    }

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
      firstName,
      lastName,
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
        firstName: created.user.firstName,
        lastName: created.user.lastName,
      },
    };
  }
}
