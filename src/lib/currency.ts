export function formatNaira(koboAmount: number, currency = "NGN"): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format((Number(koboAmount) || 0) / 100);
}
