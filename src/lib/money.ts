const fmtCache = new Map<string, Intl.NumberFormat>();

function numberFormat(currency: string): Intl.NumberFormat {
  let f = fmtCache.get(currency);
  if (!f) {
    // Swiss francs read best with Swiss grouping (1’412.60); everything else follows the device locale.
    const locale = currency === 'CHF' ? 'de-CH' : undefined;
    f = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    fmtCache.set(currency, f);
  }
  return f;
}

/** The number only, e.g. "1’412.60". The currency code is shown separately in the UI. */
export function formatAmount(minor: number | null, currency: string): string {
  if (minor == null) return '—';
  return numberFormat(currency).format(minor / 100);
}

export function formatMoney(minor: number | null, currency: string): string {
  return `${currency} ${formatAmount(minor, currency)}`;
}
