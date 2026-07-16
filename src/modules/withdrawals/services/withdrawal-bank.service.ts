import { randomUUID } from 'crypto';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { customError } from '../../../common/exceptions/custom-error';
import type { ServiceResponseData } from '../../../common/handlers/response-handler';
import { hashRequestBody } from '../../../common/utils/idempotency';
import { AppLogger, ContextLogger } from '../../../core/logger';
import { WITHDRAWAL_PAYOUT_QUEUE } from '../../../core/queue/queue.constants';
import type { JwtPayloadUser } from '../../../core/security/decorators/current-user.decorator';
import { WalletRepository } from '../../../database/repositories/wallet.repository';
import { WithdrawalRepository } from '../../../database/repositories/withdrawal.repository';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';
import { WITHDRAWAL_PAYOUT_JOB } from '../withdrawals.constants';

@Injectable()
export class WithdrawalBankService {
  private readonly log: ContextLogger;

  constructor(
    private readonly withdrawals: WithdrawalRepository,
    private readonly wallets: WalletRepository,
    @InjectQueue(WITHDRAWAL_PAYOUT_QUEUE)
    private readonly payoutQueue: Queue,
    appLogger: AppLogger,
  ) {
    this.log = appLogger.createContext(WithdrawalBankService.name);
  }

  async create(
    actor: JwtPayloadUser,
    dto: CreateWithdrawalDto,
    idempotencyKey: string,
  ): Promise<ServiceResponseData> {
    const currency = (dto.currency ?? 'NGN').toUpperCase();
    if (currency !== 'NGN') {
      throw customError.badRequest('Only NGN is supported');
    }

    if (!dto.bankCode?.trim() || !dto.accountNumber?.trim() || !dto.accountName?.trim()) {
      throw customError.badRequest(
        'bankCode, accountNumber, and accountName are required for BANK withdrawals',
      );
    }

    const bankCode = dto.bankCode.trim();
    const accountNumber = dto.accountNumber.trim();
    const accountName = dto.accountName.trim();

    const bodyHash = hashRequestBody({
      destinationType: 'BANK',
      bankCode,
      accountNumber,
      accountName,
      amount: dto.amount,
      currency,
    });

    const wallet = await this.wallets.findByUserId(actor.userId);
    if (!wallet) {
      throw customError.notFound('Wallet not found');
    }
    if (wallet.status !== 'ACTIVE') {
      throw customError.unprocessableEntity('Wallet is not active');
    }

    const providerReference = `wd_${actor.userId.slice(0, 8)}_${randomUUID().replace(/-/g, '')}`;

    const result = await this.withdrawals.executeBankAccept({
      userId: actor.userId,
      walletId: wallet.id,
      amount: dto.amount,
      currency,
      bankCode,
      accountNumber,
      accountName,
      providerReference,
      idempotencyKey,
      requestBodyHash: bodyHash,
    });

    if (result.created) {
      await this.payoutQueue.add(
        WITHDRAWAL_PAYOUT_JOB,
        { withdrawalId: result.withdrawal.id },
        {
          jobId: `withdrawal-payout-${result.withdrawal.id}`,
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
      this.log.action('Bank withdrawal accepted and queued', {
        userId: actor.userId,
        withdrawalId: result.withdrawal.id,
        amount: dto.amount,
        providerReference,
      });
    } else {
      this.log.action('Bank withdrawal idempotent replay', {
        userId: actor.userId,
        withdrawalId: result.withdrawal.id,
      });
    }

    return {
      message: result.created
        ? 'Bank withdrawal accepted and queued for payout'
        : 'Withdrawal already exists (idempotent replay)',
      withdrawal: {
        id: result.withdrawal.id,
        amount: result.withdrawal.amount,
        currency: result.withdrawal.currency,
        destinationType: result.withdrawal.destinationType,
        status: result.withdrawal.status,
        providerReference: result.withdrawal.providerReference,
        createdAt: result.withdrawal.createdAt,
      },
    };
  }
}
