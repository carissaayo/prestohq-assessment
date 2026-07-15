/** Public wallets API response shapes (optional typing aid). */
export interface WalletBalanceView {
  id: string;
  userId: string;
  currency: string;
  status: string;
  balance: number;
}
