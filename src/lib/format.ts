/** Client-safe currency formatting (NGN kobo → naira string). */
export function formatNaira(koboAmount: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format((koboAmount || 0) / 100);
}
