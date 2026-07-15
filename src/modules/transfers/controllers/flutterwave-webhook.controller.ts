import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SkipResponseTransform } from '../../../common/decorators/skip-response-transform.decorator';
import { Public } from '../../../core/security/decorators/public.decorator';
import { TransfersService } from '../services/transfers.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class FlutterwaveWebhookController {
  constructor(private readonly transfers: TransfersService) {}

  @Public()
  @Post('flutterwave')
  @HttpCode(HttpStatus.OK)
  @SkipResponseTransform()
  @ApiHeader({
    name: 'verif-hash',
    required: true,
    description: 'Must match FLUTTERWAVE_WEBHOOK_SECRET',
  })
  @ApiOperation({
    summary: 'Flutterwave webhook',
    description:
      'Verify verif-hash → persist WebhookEvent → enqueue BullMQ. Always returns 200 when accepted; money moves in workers only.',
  })
  async handle(
    @Headers('verif-hash') verifHash: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.transfers.handleFlutterwaveWebhook(
      verifHash,
      body,
    );
    return { status: 'ok', ...result };
  }
}
