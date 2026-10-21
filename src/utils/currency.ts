export function formatRupiah(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return "Rp 0";
  }
  const rounded = Math.round(amount);
  return "Rp " + rounded.toLocaleString("id-ID");
}

export function formatThickness(mm: number): string {
  if (isNaN(mm) || mm === null || mm === undefined || Number(mm) <= 0) {
    return "-";
  }
  return `${Number(mm).toFixed(2)} mm`;
}
