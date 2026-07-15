import { Injectable } from '@nestjs/common';

import { customError } from '../../../common/exceptions/custom-error';
import type { ServiceResponseData } from '../../../common/handlers/response-handler';
import type { JwtPayloadUser } from '../../../core/security/decorators/current-user.decorator';
import { WalletRepository } from '../../../database/repositories/wallet.repository';
import { WalletTransactionRepository } from '../../../database/repositories/wallet-transaction.repository';
import { ListWalletTransactionsQueryDto } from '../dto/list-wallet-transactions-query.dto';
import { WalletLedgerService } from './wallet-ledger.service';

@Injectable()
export class WalletsService {
  constructor(
    private readonly wallets: WalletRepository,
    private readonly journal: WalletTransactionRepository,
    private readonly ledger: WalletLedgerService,
  ) {}

  async getMe(actor: JwtPayloadUser): Promise<ServiceResponseData> {
    const wallet = await this.requireWallet(actor.userId);
    const balance = await this.ledger.getSuccessfulBalance(wallet.id);

    return {
      message: 'Wallet retrieved successfully',
      wallet: {
        id: wallet.id,
        userId: wallet.userId,
        currency: wallet.currency,
        status: wallet.status,
        /** Fresh: SUM(successful credits) − SUM(successful debits). */
        balance,
      },
    };
  }

  async listMyTransactions(
    actor: JwtPayloadUser,
    query: ListWalletTransactionsQueryDto,
  ): Promise<ServiceResponseData> {
    const wallet = await this.requireWallet(actor.userId);
    const page = await this.journal.listByWalletId({
      walletId: wallet.id,
      limit: query.limit,
      cursor: query.cursor,
    });

    return {
      message: 'Wallet transactions retrieved successfully',
      transactions: page.items,
      nextCursor: page.nextCursor,
    };
  }

  private async requireWallet(userId: string) {
    const wallet = await this.wallets.findByUserId(userId);
    if (!wallet) {
      throw customError.notFound('Wallet not found');
    }
    return wallet;
  }
}
