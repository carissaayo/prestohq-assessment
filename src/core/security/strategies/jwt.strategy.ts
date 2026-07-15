import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { JwtPayloadUser } from '../decorators/current-user.decorator';

type AccessTokenPayload = {
  sub: string;
  email: string;
  username: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
    });
  }

  validate(payload: AccessTokenPayload): JwtPayloadUser {
    return {
      userId: payload.sub,
      email: payload.email,
      username: payload.username,
    };
  }
}
