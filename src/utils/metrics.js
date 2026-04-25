// Aggregates raw rows into metric totals
export function aggregateRows(rows) {
  return rows.reduce(
    (acc, row) => {
      acc.spend += row.spend
      acc.revenue += row.revenue
      acc.orders += row.orders
      acc.new_customers += row.new_customers
      acc.cogs += row.cogs
      return acc
    },
    { spend: 0, revenue: 0, orders: 0, new_customers: 0, cogs: 0 }
  )
}

// Computes the 8 KPI metrics from aggregated totals
export function computeMetrics(agg) {
  const { spend, revenue, orders, new_customers, cogs } = agg
  return {
    revenue,
    spend,
    roas: revenue > 0 && spend > 0 ? revenue / spend : 0,
    cos: revenue > 0 ? (spend / revenue) * 100 : 0,
    acos: new_customers > 0 ? spend / new_customers : 0,
    gcos: revenue > 0 ? ((spend + cogs) / revenue) * 100 : 0,
    ncac: new_customers > 0 ? spend / new_customers : 0,
    cac: orders > 0 ? spend / orders : 0,
  }
}

// Filters rows by date range (days back from today)
export function filterByDays(rows, days) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  cutoff.setHours(0, 0, 0, 0)
  return rows.filter((r) => new Date(r.date) >= cutoff)
}

// Filters rows by channel ('All' returns everything)
export function filterByChannel(rows, channel) {
  if (!channel || channel === 'All') return rows
  return rows.filter((r) => r.channel === channel)
}

// Groups rows by date, returns sorted array of { date, ...aggregated }
export function groupByDate(rows) {
  const map = {}
  for (const row of rows) {
    if (!map[row.date]) map[row.date] = { date: row.date, spend: 0, revenue: 0, orders: 0, new_customers: 0, cogs: 0 }
    map[row.date].spend += row.spend
    map[row.date].revenue += row.revenue
    map[row.date].orders += row.orders
    map[row.date].new_customers += row.new_customers
    map[row.date].cogs += row.cogs
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
}

// Groups rows by channel, returns array of { channel, ...aggregated, ...metrics }
export function groupByChannel(rows) {
  const map = {}
  for (const row of rows) {
    if (!map[row.channel]) map[row.channel] = { channel: row.channel, spend: 0, revenue: 0, orders: 0, new_customers: 0, cogs: 0 }
    map[row.channel].spend += row.spend
    map[row.channel].revenue += row.revenue
    map[row.channel].orders += row.orders
    map[row.channel].new_customers += row.new_customers
    map[row.channel].cogs += row.cogs
  }
  return Object.values(map).map((ch) => ({ ...ch, ...computeMetrics(ch) }))
}

export const METRIC_DEFS = [
  { key: 'revenue', label: 'Revenue', format: 'currency', higherIsBetter: true, description: 'Total revenue attributed to paid social' },
  { key: 'spend', label: 'Spend', format: 'currency', higherIsBetter: false, description: 'Total ad spend across all channels' },
  { key: 'roas', label: 'ROAS', format: 'decimal', higherIsBetter: true, description: 'Return on ad spend (Revenue ÷ Spend)' },
  { key: 'cos', label: 'COS%', format: 'percent', higherIsBetter: false, description: 'Cost of sale percentage (Spend ÷ Revenue × 100)' },
  { key: 'acos', label: 'ACOS', format: 'currency', higherIsBetter: false, description: 'Advertising cost per new customer (Spend ÷ New Customers)' },
  { key: 'gcos', label: 'GCOS%', format: 'percent', higherIsBetter: false, description: 'Gross cost of sale ((Spend + COGS) ÷ Revenue × 100)' },
  { key: 'ncac', label: 'NCAC', format: 'currency', higherIsBetter: false, description: 'New customer acquisition cost (Spend ÷ New Customers)' },
  { key: 'cac', label: 'CAC', format: 'currency', higherIsBetter: false, description: 'Customer acquisition cost (Spend ÷ Total Orders)' },
]

export const DEFAULT_TARGETS = {
  revenue: 500000,
  spend: 100000,
  roas: 4.0,
  cos: 25,
  acos: 45,
  gcos: 60,
  ncac: 45,
  cac: 30,
}

export function formatValue(value, format) {
  if (value === null || value === undefined || isNaN(value)) return '—'
  switch (format) {
    case 'currency':
      return value >= 1000
        ? '$' + (value / 1000).toFixed(1) + 'k'
        : '$' + value.toFixed(2)
    case 'percent':
      return value.toFixed(1) + '%'
    case 'decimal':
      return value.toFixed(2) + 'x'
    default:
      return value.toFixed(2)
  }
}

export function getStatus(key, actual, target, higherIsBetter) {
  if (!target || target === 0) return 'neutral'
  const ratio = actual / target
  if (higherIsBetter) {
    if (ratio >= 0.95) return 'green'
    if (ratio >= 0.8) return 'amber'
    return 'red'
  } else {
    if (ratio <= 1.05) return 'green'
    if (ratio <= 1.2) return 'amber'
    return 'red'
  }
}

export function generateInsight(metrics, targets) {
  const good = []
  const attention = []

  for (const def of METRIC_DEFS) {
    const actual = metrics[def.key]
    const target = targets[def.key]
    if (!target) continue
    const status = getStatus(def.key, actual, target, def.higherIsBetter)
    if (status === 'green') good.push(def.label)
    else if (status === 'red') attention.push(def.label)
  }

  const parts = []
  if (good.length > 0) {
    parts.push(`${good.join(', ')} ${good.length === 1 ? 'is' : 'are'} on track and meeting targets.`)
  }
  if (attention.length > 0) {
    parts.push(`${attention.join(', ')} ${attention.length === 1 ? 'needs' : 'need'} attention — currently off target.`)
  }
  if (parts.length === 0) {
    parts.push('Performance is close to targets across all metrics.')
  }

  const roasVal = metrics.roas?.toFixed(2)
  const cosVal = metrics.cos?.toFixed(1)
  if (roasVal) parts.push(`Blended ROAS is ${roasVal}x with a ${cosVal}% cost of sale.`)

  return parts.join(' ')
}
