import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  CurrentUser,
  type JwtPayloadUser,
} from '../../../core/security/decorators/current-user.decorator';
import { Public } from '../../../core/security/decorators/public.decorator';
import { CreatePinDto } from '../dto/create-pin.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { AuthService } from '../services/auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register with email, username, password' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('pin')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create transaction PIN',
    description:
      'Required before funding (`POST /transfers`) or withdrawing (`POST /withdrawals`). Body: `pin`, `confirmPin` (must match), and account `password`.',
  })
  createPin(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreatePinDto,
  ) {
    return this.auth.createPin(user, dto);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Current authenticated user + wallet id' })
  me(@CurrentUser() user: JwtPayloadUser) {
    return this.auth.me(user);
  }
}
