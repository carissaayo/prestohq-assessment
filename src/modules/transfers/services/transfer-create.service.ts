import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { customError } from '../../../common/exceptions/custom-error';
import type { ServiceResponseData } from '../../../common/handlers/response-handler';
import { AppLogger, ContextLogger } from '../../../core/logger';
import type { JwtPayloadUser } from '../../../core/security/decorators/current-user.decorator';
import { TransferRepository } from '../../../database/repositories/transfer.repository';
import { UserRepository } from '../../../database/repositories/user.repository';
import { WalletRepository } from '../../../database/repositories/wallet.repository';
import { AuthService } from '../../auth/services/auth.service';
import {
  FLUTTERWAVE_PROVIDER,
  type IFlutterwaveProvider,
} from '../../payment-providers/flutterwave/flutterwave-payment.interface';
import { WalletLedgerService } from '../../wallets/services/wallet-ledger.service';
import { CreateTransferDto } from '../dto/create-transfer.dto';
import {
  hashRequestBody,
  newFlutterwaveTxRef,
} from './transfer-idempotency.util';

@Injectable()
export class TransferCreateService {
  private readonly log: ContextLogger;

  constructor(
    private readonly transfers: TransferRepository,
    private readonly users: UserRepository,
    private readonly wallets: WalletRepository,
    private readonly ledger: WalletLedgerService,
    private readonly auth: AuthService,
    @Inject(FLUTTERWAVE_PROVIDER)
    private readonly flutterwave: IFlutterwaveProvider,
    private readonly config: ConfigService,
    appLogger: AppLogger,
  ) {
    this.log = appLogger.createContext(TransferCreateService.name);
  }

  async create(
    actor: JwtPayloadUser,
    dto: CreateTransferDto,
    idempotencyKey: string,
  ): Promise<ServiceResponseData> {
    await this.auth.verifyPin(actor.userId, dto.pin);

    const currency = (dto.currency ?? 'NGN').toUpperCase();
    if (currency !== 'NGN') {
      throw customError.badRequest('Only NGN is supported');
    }

    // pin intentionally excluded from idempotency hash
    const bodyHash = hashRequestBody({
      amount: dto.amount,
      currency,
    });
    const existing = await this.transfers.findByUserAndIdempotencyKey(
      actor.userId,
      idempotencyKey,
    );
    if (existing) {
      if (existing.requestBodyHash !== bodyHash) {
        throw customError.conflict(
          'Idempotency-Key was already used with a different request body',
        );
      }
      this.log.action('Transfer idempotent replay', {
        userId: actor.userId,
        transferId: existing.id,
      });
      return this.toResponse(existing, 'Transfer already exists (idempotent replay)');
    }

    const wallet = await this.wallets.findByUserId(actor.userId);
    if (!wallet) {
      throw customError.notFound('Wallet not found');
    }

    const user = await this.users.findById(actor.userId);
    if (!user) {
      throw customError.unauthorized('User not found');
    }

    const txRef = newFlutterwaveTxRef(actor.userId);
    const transfer = await this.transfers.create({
      userId: actor.userId,
      walletId: wallet.id,
      amount: dto.amount,
      currency,
      flutterwaveTxRef: txRef,
      idempotencyKey,
      requestBodyHash: bodyHash,
      status: 'INITIATED',
    });

    await this.ledger.postCreditPending({
      walletId: wallet.id,
      amount: dto.amount,
      purpose: 'FLUTTERWAVE_FUNDING',
      idempotencyKey: `funding:${actor.userId}:${idempotencyKey}`,
      transferId: transfer.id,
      reference: txRef,
    });

    const redirectUrl =
      this.config.get<string>('flutterwave.redirectUrl') ??
      'http://localhost:3010/funding/callback';

    this.log.action('Initiating Flutterwave payment', {
      transferId: transfer.id,
      txRef,
      amount: dto.amount,
      userId: actor.userId,
    });

    const payment = await this.flutterwave.initiatePayment({
      txRef,
      amountKobo: dto.amount,
      currency,
      redirectUrl,
      customer: {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
      },
    });

    const updated = await this.transfers.update(transfer.id, {
      status: 'PENDING',
      checkoutUrl: payment.checkoutUrl,
      flutterwaveId: payment.providerPaymentId ?? null,
    });

    this.log.action('Transfer initiated', {
      transferId: updated.id,
      txRef,
      flutterwaveId: payment.providerPaymentId,
    });

    return this.toResponse(updated, 'Transfer initiated successfully');
  }

  private toResponse(
    transfer: {
      id: string;
      amount: number;
      currency: string;
      status: string;
      flutterwaveTxRef: string;
      checkoutUrl: string | null;
      createdAt: Date;
    },
    message: string,
  ): ServiceResponseData {
    return {
      message,
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
}
