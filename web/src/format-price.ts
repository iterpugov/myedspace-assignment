/** Pence as pounds, without pence when the amount is whole: 19900 → "£199". */
export function formatPrice(pricePence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: pricePence % 100 === 0 ? 0 : 2,
  }).format(pricePence / 100);
}
