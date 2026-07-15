/** Money helpers — amounts are always integer minor units (kobo). */

export function assertPositiveKobo(amount: number, field = 'amount'): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`${field} must be a positive integer (kobo)`);
  }
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}
