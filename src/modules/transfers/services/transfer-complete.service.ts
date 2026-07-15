import { Inject, Injectable } from '@nestjs/common';

import { customError } from '../../../common/exceptions/custom-error';
import { AppLogger, ContextLogger } from '../../../core/logger';
import { TransferRepository } from '../../../database/repositories/transfer.repository';
import { WalletTransactionRepository } from '../../../database/repositories/wallet-transaction.repository';
import { WebhookEventRepository } from '../../../database/repositories/webhook-event.repository';
import { WalletLedgerService } from '../../wallets/services/wallet-ledger.service';
import {
  FLUTTERWAVE_PROVIDER,
  type IFlutterwaveProvider,
} from '../providers/flutterwave.interface';

@Injectable()
export class TransferCompleteService {
  private readonly log: ContextLogger;

  constructor(
    private readonly transfers: TransferRepository,
    private readonly journal: WalletTransactionRepository,
    private readonly webhooks: WebhookEventRepository,
    private readonly ledger: WalletLedgerService,
    @Inject(FLUTTERWAVE_PROVIDER)
    private readonly flutterwave: IFlutterwaveProvider,
    appLogger: AppLogger,
  ) {
    this.log = appLogger.createContext(TransferCompleteService.name);
  }

  async completeFromWebhook(webhookEventId: string): Promise<void> {
    const event = await this.webhooks.findById(webhookEventId);
    if (!event) {
      this.log.warn('Webhook event missing', { webhookEventId });
      return;
    }
    if (event.status === 'PROCESSED') {
      return;
    }

    const txRef =
      event.reference ||
      this.extractTxRef(event.payload);

    if (!txRef) {
      await this.webhooks.markFailed(event.id);
      throw customError.badRequest('Webhook missing tx_ref');
    }

    const transfer = await this.transfers.findByFlutterwaveTxRef(txRef);
    if (!transfer) {
      await this.webhooks.markFailed(event.id);
      this.log.warn('No transfer for tx_ref', { txRef });
      return;
    }

    if (transfer.status === 'SUCCESSFUL') {
      await this.webhooks.markProcessed(event.id);
      return;
    }

    const verified = await this.flutterwave.verifyByTxRef(txRef);
    if (verified.status !== 'successful') {
      if (verified.status === 'failed') {
        await this.transfers.update(transfer.id, { status: 'FAILED' });
        await this.webhooks.markProcessed(event.id);
      }
      this.log.warn('Payment not successful yet', {
        txRef,
        status: verified.status,
      });
      return;
    }

    // Prefer our stored amount; mock verify may report 0.
    const amountOk =
      verified.amountKobo === 0 || verified.amountKobo === transfer.amount;
    if (!amountOk || verified.currency !== transfer.currency) {
      await this.webhooks.markFailed(event.id);
      throw customError.unprocessableEntity(
        'Verified payment amount/currency mismatch',
      );
    }

    const credits = await this.journal.findByTransferId(transfer.id);
    const pending = credits.find(
      (c) => c.type === 'CREDIT' && c.status === 'PENDING',
    );
    const already = credits.find(
      (c) => c.type === 'CREDIT' && c.status === 'SUCCESSFUL',
    );

    if (!already) {
      if (!pending) {
        await this.webhooks.markFailed(event.id);
        throw customError.internalServerError(
          'Pending credit journal missing for transfer',
        );
      }
      await this.ledger.completeCreditSuccessful({
        transactionId: pending.id,
        expectedWalletId: transfer.walletId,
      });
    }

    await this.transfers.update(transfer.id, {
      status: 'SUCCESSFUL',
      flutterwaveId: verified.providerTransactionId ?? transfer.flutterwaveId,
    });
    await this.webhooks.markProcessed(event.id);
    this.log.action('Transfer completed', { transferId: transfer.id, txRef });
  }

  private extractTxRef(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const data = payload as Record<string, unknown>;
    const nested = data.data;
    if (nested && typeof nested === 'object') {
      const txRef = (nested as Record<string, unknown>).tx_ref;
      if (typeof txRef === 'string') return txRef;
    }
    if (typeof data.txRef === 'string') return data.txRef;
    if (typeof data.tx_ref === 'string') return data.tx_ref;
    return null;
  }
}
