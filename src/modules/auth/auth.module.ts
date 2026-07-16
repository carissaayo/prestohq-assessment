import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthController } from './controllers/auth.controller';
import { AuthCreatePinService } from './services/auth-create-pin.service';
import { AuthCredentialService } from './services/auth-credential.service';
import { AuthLoginService } from './services/auth-login.service';
import { AuthRegisterService } from './services/auth-register.service';
import { AuthTokenService } from './services/auth-token.service';
import { AuthService } from './services/auth.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRegisterService,
    AuthLoginService,
    AuthCreatePinService,
    AuthCredentialService,
    AuthTokenService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
