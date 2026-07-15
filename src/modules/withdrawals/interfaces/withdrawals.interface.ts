export interface WithdrawalView {
  id: string;
  amount: number;
  currency: string;
  destinationType: string;
  destinationWalletId: string | null;
  status: string;
  createdAt: Date;
}
