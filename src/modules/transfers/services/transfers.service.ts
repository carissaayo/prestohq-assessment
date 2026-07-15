import { Injectable } from '@nestjs/common';

import { customError } from '../../../common/exceptions/custom-error';
import type { ServiceResponseData } from '../../../common/handlers/response-handler';
import type { JwtPayloadUser } from '../../../core/security/decorators/current-user.decorator';
import { TransferRepository } from '../../../database/repositories/transfer.repository';
import { CreateTransferDto } from '../dto/create-transfer.dto';
import { TransferCreateService } from './transfer-create.service';
import { TransferWebhookService } from './transfer-webhook.service';

@Injectable()
export class TransfersService {
  constructor(
    private readonly createService: TransferCreateService,
    private readonly webhookService: TransferWebhookService,
    private readonly transfers: TransferRepository,
  ) {}

  create(
    actor: JwtPayloadUser,
    dto: CreateTransferDto,
    idempotencyKey: string,
  ): Promise<ServiceResponseData> {
    return this.createService.create(actor, dto, idempotencyKey);
  }

  async getOne(
    actor: JwtPayloadUser,
    transferId: string,
  ): Promise<ServiceResponseData> {
    const transfer = await this.transfers.findById(transferId);
    if (!transfer || transfer.userId !== actor.userId) {
      throw customError.notFound('Transfer not found');
    }

    return {
      message: 'Transfer retrieved successfully',
      transfer: {
        id: transfer.id,
        amount: transfer.amount,
        currency: transfer.currency,
        status: transfer.status,
        flutterwaveTxRef: transfer.flutterwaveTxRef,
        checkoutUrl: transfer.checkoutUrl,
        createdAt: transfer.createdAt,
      },
    };
  }

  handleFlutterwaveWebhook(
    verifHash: string | undefined,
    body: Record<string, unknown>,
  ) {
    return this.webhookService.handleFlutterwaveWebhook(verifHash, body);
  }
}
