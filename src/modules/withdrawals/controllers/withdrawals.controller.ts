import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

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
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Client-supplied UUID v4 (new key per distinct request)',
    schema: {
      type: 'string',
      format: 'uuid',
      example: '99e643eb-53f9-441f-9f44-73fc528328e4',
    },
  })
  @ApiOperation({
    summary:
      'Withdraw to another wallet (P2P) or bank account. Transfer = funding; Withdrawal = outflow.',
    description:
      'Requires transaction PIN (`pin`) and `Idempotency-Key` (UUID v4). `pin` is not part of the idempotency hash. ' +
      'WALLET: send `recipientUsername` only. BANK: send `bankCode`, `accountNumber`, `accountName` only (no username).',
  })
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateWithdrawalDto,
    @Req() req: Request,
  ) {
    const idempotencyKey = requireIdempotencyKey(req.headers['idempotency-key']);
    return this.withdrawals.create(user, dto, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'List withdrawals for the current user (newest first)' })
  listMine(@CurrentUser() user: JwtPayloadUser) {
    return this.withdrawals.listMine(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a withdrawal by id (sender only)' })
  getOne(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.withdrawals.getOne(user, id);
  }
}
