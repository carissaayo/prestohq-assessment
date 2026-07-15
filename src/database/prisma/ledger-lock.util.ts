import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

type TxClient = Prisma.TransactionClient;

export async function lockWalletRow(
  tx: TxClient,
  walletId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM wallets WHERE id = ${walletId} FOR UPDATE
  `;
  if (!rows.length) {
    throw new Error(`Wallet not found: ${walletId}`);
  }
}

export async function sumSuccessfulBalance(
  client: TxClient | PrismaService,
  walletId: string,
): Promise<number> {
  const rows = await client.$queryRaw<{ balance: bigint | number | null }[]>`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END), 0)
      AS balance
    FROM wallet_transactions
    WHERE "walletId" = ${walletId}
      AND status = 'SUCCESSFUL'
  `;
  const raw = rows[0]?.balance ?? 0;
  return typeof raw === 'bigint' ? Number(raw) : Number(raw);
}

/** Ascending id order — avoids deadlocks on concurrent opposite P2P. */
export function sortWalletIds(...ids: string[]): string[] {
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
