import { Injectable } from '@nestjs/common';

import { customError } from '../../../common/exceptions/custom-error';
import type { ServiceResponseData } from '../../../common/handlers/response-handler';
import { hashRequestBody } from '../../../common/utils/idempotency';
import type { JwtPayloadUser } from '../../../core/security/decorators/current-user.decorator';
import { UserRepository } from '../../../database/repositories/user.repository';
import { WalletRepository } from '../../../database/repositories/wallet.repository';
import { WithdrawalRepository } from '../../../database/repositories/withdrawal.repository';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';

@Injectable()
export class WithdrawalP2pService {
  constructor(
    private readonly withdrawals: WithdrawalRepository,
    private readonly users: UserRepository,
    private readonly wallets: WalletRepository,
  ) {}

  async create(
    actor: JwtPayloadUser,
    dto: CreateWithdrawalDto,
    idempotencyKey: string,
  ): Promise<ServiceResponseData> {
    const currency = (dto.currency ?? 'NGN').toUpperCase();
    if (currency !== 'NGN') {
      throw customError.badRequest('Only NGN is supported');
    }

    const recipientUsername = dto.recipientUsername.trim().toLowerCase();
    const bodyHash = hashRequestBody({
      destinationType: 'WALLET',
      recipientUsername,
      amount: dto.amount,
      currency,
    });

    const senderWallet = await this.wallets.findByUserId(actor.userId);
    if (!senderWallet) {
      throw customError.notFound('Wallet not found');
    }

    const recipient = await this.users.findByUsername(recipientUsername);
    if (!recipient) {
      throw customError.notFound('Recipient user not found');
    }
    if (recipient.id === actor.userId) {
      throw customError.badRequest('Cannot transfer to your own wallet');
    }

    const recipientWallet = await this.wallets.findByUserId(recipient.id);
    if (!recipientWallet) {
      throw customError.notFound('Recipient wallet not found');
    }
    if (recipientWallet.status !== 'ACTIVE' || senderWallet.status !== 'ACTIVE') {
      throw customError.unprocessableEntity('Wallet is not active');
    }

    const result = await this.withdrawals.executeP2p({
      userId: actor.userId,
      senderWalletId: senderWallet.id,
      destinationWalletId: recipientWallet.id,
      amount: dto.amount,
      currency,
      idempotencyKey,
      requestBodyHash: bodyHash,
    });

    return {
      message: result.created
        ? 'P2P withdrawal completed successfully'
        : 'Withdrawal already exists (idempotent replay)',
      withdrawal: {
        id: result.withdrawal.id,
        amount: result.withdrawal.amount,
        currency: result.withdrawal.currency,
        destinationType: result.withdrawal.destinationType,
        destinationWalletId: result.withdrawal.destinationWalletId,
        status: result.withdrawal.status,
        createdAt: result.withdrawal.createdAt,
      },
    };
  }
}
