import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { UserEntity } from '../../../database/repositories/user.repository';

@Injectable()
export class AuthTokenService {
  constructor(private readonly jwt: JwtService) {}

  signAccessToken(user: UserEntity): string {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      username: user.username,
    });
  }
}
