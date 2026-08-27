export function formatCurrency(value: number) {
  if (value >= 1_000_000_000) {
    return `Rp${(value / 1_000_000_000).toFixed(2)} M`;
  }

  if (value >= 1_000_000) {
    return `Rp${(value / 1_000_000).toFixed(1)} jt`;
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(Math.round(value));
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}
