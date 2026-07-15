import { Injectable } from '@nestjs/common';

import { customError } from '../../../common/exceptions/custom-error';
import type { ServiceResponseData } from '../../../common/handlers/response-handler';
import type { JwtPayloadUser } from '../../../core/security/decorators/current-user.decorator';
import { WithdrawalRepository } from '../../../database/repositories/withdrawal.repository';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';
import { WithdrawalBankService } from './withdrawal-bank.service';
import { WithdrawalP2pService } from './withdrawal-p2p.service';

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly p2p: WithdrawalP2pService,
    private readonly bank: WithdrawalBankService,
    private readonly withdrawals: WithdrawalRepository,
  ) {}

  create(
    actor: JwtPayloadUser,
    dto: CreateWithdrawalDto,
    idempotencyKey: string,
  ): Promise<ServiceResponseData> {
    if (dto.destinationType === 'WALLET') {
      return this.p2p.create(actor, dto, idempotencyKey);
    }
    return this.bank.create(actor, dto, idempotencyKey);
  }

  async getOne(
    actor: JwtPayloadUser,
    withdrawalId: string,
  ): Promise<ServiceResponseData> {
    const withdrawal = await this.withdrawals.findById(withdrawalId);
    if (!withdrawal || withdrawal.userId !== actor.userId) {
      throw customError.notFound('Withdrawal not found');
    }

    return {
      message: 'Withdrawal retrieved successfully',
      withdrawal: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        destinationType: withdrawal.destinationType,
        destinationWalletId: withdrawal.destinationWalletId,
        status: withdrawal.status,
        providerReference: withdrawal.providerReference,
        createdAt: withdrawal.createdAt,
      },
    };
  }
}
