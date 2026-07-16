import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { customError } from '../../../common/exceptions/custom-error';
import { AppLogger, ContextLogger } from '../../../core/logger';
import {
  type UserEntity,
  UserRepository,
} from '../../../database/repositories/user.repository';
import { AUTH_LOCK_MS, MAX_AUTH_TRIES } from '../auth.constants';

@Injectable()
export class AuthCredentialService {
  private readonly log: ContextLogger;

  constructor(
    private readonly users: UserRepository,
    appLogger: AppLogger,
  ) {
    this.log = appLogger.createContext(AuthCredentialService.name);
  }

  assertNotLocked(lockedUntil: Date | null, label: string): void {
    if (lockedUntil && lockedUntil > new Date()) {
      const secondsLeft = Math.ceil(
        (lockedUntil.getTime() - Date.now()) / 1000,
      );
      this.log.warn(`${label} attempt blocked by cooldown`, { secondsLeft });
      throw customError.unauthorized(
        `Too many attempts. Try again in ${secondsLeft} seconds.`,
      );
    }
  }

  lockUntilIfMaxed(attempts: number): Date | null {
    return attempts >= MAX_AUTH_TRIES
      ? new Date(Date.now() + AUTH_LOCK_MS)
      : null;
  }

  async verifyPasswordOrThrow(
    user: UserEntity,
    password: string,
    invalidMessage = 'Invalid credentials',
  ): Promise<void> {
    if (user.passwordLockedUntil && user.passwordLockedUntil <= new Date()) {
      await this.users.resetPasswordFailures(user.id);
      user.passwordTryCount = 0;
      user.passwordLockedUntil = null;
    }

    this.assertNotLocked(user.passwordLockedUntil, 'Password');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const attempts = user.passwordTryCount + 1;
      const lockedUntil = this.lockUntilIfMaxed(attempts);
      await this.users.recordPasswordFailure(user.id, attempts, lockedUntil);
      this.log.warn('Password validation failed', {
        userId: user.id,
        attempts,
      });
      throw customError.unauthorized(invalidMessage);
    }

    if (user.passwordTryCount > 0 || user.passwordLockedUntil) {
      await this.users.resetPasswordFailures(user.id);
    }
  }

  async verifyPinOrThrow(userId: string, pin: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw customError.unauthorized('User not found');
    }

    if (!user.pinHash) {
      throw customError.forbidden(
        'you need to set up your transaction pin first',
      );
    }

    if (user.pinLockedUntil && user.pinLockedUntil <= new Date()) {
      await this.users.resetPinFailures(user.id);
      user.pinTryCount = 0;
      user.pinLockedUntil = null;
    }

    this.assertNotLocked(user.pinLockedUntil, 'PIN');

    const valid = await bcrypt.compare(pin, user.pinHash);
    if (!valid) {
      const attempts = user.pinTryCount + 1;
      const lockedUntil = this.lockUntilIfMaxed(attempts);
      await this.users.recordPinFailure(user.id, attempts, lockedUntil);
      this.log.warn('PIN validation failed', { userId: user.id, attempts });
      throw customError.unauthorized('Invalid PIN');
    }

    if (user.pinTryCount > 0 || user.pinLockedUntil) {
      await this.users.resetPinFailures(user.id);
    }
  }
}
