function ean13CheckDigit(first12Digits) {
  const sum = first12Digits
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

export function generateEAN13Barcode(seed = Date.now()) {
  const base = String(Math.abs(Number(seed)) || Date.now()).replace(/\D/g, '');
  const random = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  const first12 = (`200${base}${random}`).slice(0, 12).padEnd(12, '0');
  return first12 + ean13CheckDigit(first12);
}

export function formatDateTime(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('fr-DZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}
