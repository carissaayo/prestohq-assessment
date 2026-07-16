import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { customError } from '../../../common/exceptions/custom-error';
import type { ServiceResponseData } from '../../../common/handlers/response-handler';
import { AppLogger, ContextLogger } from '../../../core/logger';
import type { JwtPayloadUser } from '../../../core/security/decorators/current-user.decorator';
import { UserRepository } from '../../../database/repositories/user.repository';
import { BCRYPT_ROUNDS } from '../auth.constants';
import { CreatePinDto } from '../dto/create-pin.dto';
import { AuthCredentialService } from './auth-credential.service';

@Injectable()
export class AuthCreatePinService {
  private readonly log: ContextLogger;

  constructor(
    private readonly users: UserRepository,
    private readonly credentials: AuthCredentialService,
    appLogger: AppLogger,
  ) {
    this.log = appLogger.createContext(AuthCreatePinService.name);
  }

  async create(
    actor: JwtPayloadUser,
    dto: CreatePinDto,
  ): Promise<ServiceResponseData> {
    if (dto.pin !== dto.confirmPin) {
      throw customError.badRequest('pin and confirmPin do not match');
    }

    const user = await this.users.findById(actor.userId);
    if (!user) {
      throw customError.unauthorized('User not found');
    }

    if (user.pinHash) {
      throw customError.conflict('PIN is already set');
    }

    await this.credentials.verifyPasswordOrThrow(
      user,
      dto.password,
      'Invalid credentials',
    );

    const pinHash = await bcrypt.hash(dto.pin, BCRYPT_ROUNDS);
    await this.users.setPinHash(user.id, pinHash);

    this.log.action('Wallet PIN created', { userId: user.id });

    return { message: 'PIN created successfully' };
  }
}
