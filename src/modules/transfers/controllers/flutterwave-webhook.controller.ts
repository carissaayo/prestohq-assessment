import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';

import { SkipResponseTransform } from '../../../common/decorators/skip-response-transform.decorator';
import { Public } from '../../../core/security/decorators/public.decorator';
import { TransfersService } from '../services/transfers.service';

@ApiTags('webhooks')
@ApiExcludeController()
@Controller('webhooks')
export class FlutterwaveWebhookController {
  constructor(private readonly transfers: TransfersService) {}

  @Public()
  @Post('flutterwave')
  @HttpCode(HttpStatus.OK)
  @SkipResponseTransform()
  @ApiOperation({ summary: 'Flutterwave webhook (signature via verif-hash)' })
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
