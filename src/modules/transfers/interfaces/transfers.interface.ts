export interface TransferView {
  id: string;
  amount: number;
  currency: string;
  status: string;
  flutterwaveTxRef: string;
  checkoutUrl: string | null;
  createdAt: Date;
}
