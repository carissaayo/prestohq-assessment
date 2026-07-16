import { Injectable } from '@nestjs/common';

import { customError } from '../../../common/exceptions/custom-error';
import type { ServiceResponseData } from '../../../common/handlers/response-handler';
import type { JwtPayloadUser } from '../../../core/security/decorators/current-user.decorator';
import {
  type WithdrawalEntity,
  WithdrawalRepository,
} from '../../../database/repositories/withdrawal.repository';
import { AuthService } from '../../auth/services/auth.service';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';
import { WithdrawalBankService } from './withdrawal-bank.service';
import { WithdrawalP2pService } from './withdrawal-p2p.service';

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly p2p: WithdrawalP2pService,
    private readonly bank: WithdrawalBankService,
    private readonly withdrawals: WithdrawalRepository,
    private readonly auth: AuthService,
  ) {}

  async create(
    actor: JwtPayloadUser,
    dto: CreateWithdrawalDto,
    idempotencyKey: string,
  ): Promise<ServiceResponseData> {
    await this.auth.verifyPin(actor.userId, dto.pin);

    if (dto.destinationType === 'WALLET') {
      return this.p2p.create(actor, dto, idempotencyKey);
    }
    return this.bank.create(actor, dto, idempotencyKey);
  }

  async listMine(actor: JwtPayloadUser): Promise<ServiceResponseData> {
    const rows = await this.withdrawals.listByUserId(actor.userId);
    return {
      message: 'Withdrawals retrieved successfully',
      withdrawals: rows.map((w) => this.toSummary(w)),
    };
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
      withdrawal: this.toSummary(withdrawal),
    };
  }

  private toSummary(withdrawal: WithdrawalEntity) {
    return {
      id: withdrawal.id,
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      destinationType: withdrawal.destinationType,
      destinationWalletId: withdrawal.destinationWalletId,
      status: withdrawal.status,
      providerReference: withdrawal.providerReference,
      createdAt: withdrawal.createdAt,
    };
  }
}
