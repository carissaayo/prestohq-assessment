import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import {
  CurrentUser,
  type JwtPayloadUser,
} from '../../../core/security/decorators/current-user.decorator';
import { CreateTransferDto } from '../dto/create-transfer.dto';
import { requireIdempotencyKey } from '../services/transfer-idempotency.util';
import { TransfersService } from '../services/transfers.service';

@ApiTags('transfers')
@ApiBearerAuth('access-token')
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

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
    summary: 'Fund wallet via Flutterwave (Transfer = credit/funding)',
    description:
      'Requires a transaction PIN in the body (`pin`, 4 digits). Create one with `POST /auth/pin` first. Also requires `Idempotency-Key` header (UUID v4). `pin` is not part of the idempotency hash.',
  })
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateTransferDto,
    @Req() req: Request,
  ) {
    const idempotencyKey = requireIdempotencyKey(req.headers['idempotency-key']);
    return this.transfers.create(user, dto, idempotencyKey);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a funding transfer by id' })
  getOne(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.transfers.getOne(user, id);
  }
}
