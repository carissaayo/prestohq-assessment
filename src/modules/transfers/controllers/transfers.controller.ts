import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

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
  @ApiSecurity('idempotency-key')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Client-supplied UUID v4',
  })
  @ApiOperation({
    summary: 'Fund wallet via Flutterwave (Transfer = credit/funding)',
  })
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateTransferDto,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
  ) {
    const idempotencyKey = requireIdempotencyKey(idempotencyKeyHeader);
    return this.transfers.create(user, dto, idempotencyKey);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a funding transfer by id' })
  getOne(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.transfers.getOne(user, id);
  }
}
