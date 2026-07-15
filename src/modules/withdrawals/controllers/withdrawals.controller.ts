import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

import { requireIdempotencyKey } from '../../../common/utils/idempotency';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '../../../core/security/decorators/current-user.decorator';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';
import { WithdrawalsService } from '../services/withdrawals.service';

@ApiTags('withdrawals')
@ApiBearerAuth('access-token')
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Post()
  @ApiSecurity('idempotency-key')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Client-supplied UUID v4',
  })
  @ApiOperation({
    summary:
      'Withdraw to another wallet (P2P) or bank account. Transfer = funding; Withdrawal = outflow.',
  })
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateWithdrawalDto,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
  ) {
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.withdrawals.create(user, dto, idempotencyKey);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a withdrawal by id (sender only)' })
  getOne(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.withdrawals.getOne(user, id);
  }
}
