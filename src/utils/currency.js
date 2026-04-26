const REGION_CURRENCY = {
  AU: { code: 'AUD', symbol: 'A$', locale: 'en-AU' },
  US: { code: 'USD', symbol: '$',  locale: 'en-US' },
  UK: { code: 'GBP', symbol: '£',  locale: 'en-GB' },
  Global: { code: 'USD', symbol: '$', locale: 'en-US' },
}

export function getCurrency(region) {
  return REGION_CURRENCY[region] ?? REGION_CURRENCY.Global
}

export function fmtCurrency(value, region = 'Global', decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '—'
  const { symbol } = getCurrency(region)
  return symbol + value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function fmtValue(value, format, region = 'Global') {
  if (value === null || value === undefined || isNaN(value)) return '—'
  switch (format) {
    case 'currency': return fmtCurrency(value, region)
    case 'percent':  return value.toFixed(1) + '%'
    case 'decimal':  return value.toFixed(2)
    case 'integer':  return Math.round(value).toLocaleString()
    default:         return value.toFixed(2)
  }
}
