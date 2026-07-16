import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { SkipResponseTransform } from '../../../common/decorators/skip-response-transform.decorator';
import { Public } from '../../../core/security/decorators/public.decorator';

/**
 * Browser landing page after Flutterwave checkout.
 * Does not settle money — that happens via webhook + BullMQ.
 */
@ApiExcludeController()
@Controller('funding')
export class FundingCallbackController {
  @Public()
  @Get('callback')
  @SkipResponseTransform()
  @Header('Content-Type', 'text/html; charset=utf-8')
  callback(
    @Query('status') status?: string,
    @Query('tx_ref') txRef?: string,
    @Query('transaction_id') transactionId?: string,
  ): string {
    const safeStatus = escapeHtml(status ?? 'unknown');
    const safeTxRef = escapeHtml(txRef ?? '—');
    const safeTxnId = escapeHtml(transactionId ?? '—');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Payment received</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; color: #111; }
    h1 { font-size: 1.35rem; margin-bottom: 0.5rem; }
    p { line-height: 1.5; color: #333; }
    code { background: #f3f3f3; padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Payment received</h1>
  <p>You can close this tab. Your wallet updates when Flutterwave confirms the payment (webhook).</p>
  <p>Status: <code>${safeStatus}</code></p>
  <p>Reference: <code>${safeTxRef}</code></p>
  <p>Transaction id: <code>${safeTxnId}</code></p>
</body>
</html>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
