// Core metric computation — Meta AU

export function aggregateRows(rows) {
  return rows.reduce(
    (acc, r) => {
      acc.spend        += r.spend
      acc.revenue      += r.revenue
      acc.purchases    += r.purchases
      acc.impressions  += r.impressions
      acc.clicks       += r.clicks
      acc.atc          += r.atc
      acc.checkouts    += r.checkouts
      acc.freqSum      += r.frequency * r.impressions
      acc.iRevenue     += r.iRevenue   || 0
      acc.iPurchases   += r.iPurchases || 0
      acc.iAtc         += r.iAtc       || 0
      acc.iCheckouts   += r.iCheckouts || 0
      acc.thumbStopSum += (r.thumbStopRatio || 0) * (r.impressions || 0)
      acc.hookRateSum  += (r.hookRate       || 0) * (r.impressions || 0)
      acc.views3sec  += r.views3sec  || 0
      acc.views25pct += r.views25pct || 0
      acc.reach      += r.reach      || 0
      return acc
    },
    {
      spend: 0, revenue: 0, purchases: 0, impressions: 0, clicks: 0,
      atc: 0, checkouts: 0, freqSum: 0,
      iRevenue: 0, iPurchases: 0, iAtc: 0, iCheckouts: 0,
      thumbStopSum: 0, hookRateSum: 0,
      views3sec: 0, views25pct: 0, reach: 0,
    }
  )
}

export function computeMetrics(agg) {
  const {
    spend, revenue, purchases, impressions, clicks, atc, checkouts, freqSum,
    iRevenue, iPurchases, iAtc, iCheckouts, thumbStopSum, hookRateSum,
    views3sec, views25pct, reach,
  } = agg
  const iRoas = spend > 0 && (iRevenue ?? 0) > 0 ? iRevenue / spend : 0
  const pRoas = spend > 0 && revenue > 0 ? revenue / spend : 0
  const cos   = revenue > 0 ? (spend / revenue) * 100 : 0
  return {
    revenue, spend, purchases, impressions, clicks, atc, checkouts,
    iRevenue:   iRevenue   ?? 0,
    iPurchases: iPurchases ?? 0,
    iAtc:       iAtc       ?? 0,
    iCheckouts: iCheckouts ?? 0,
    roas:      pRoas,
    iRoas,
    roasGap:   pRoas > 0 ? ((pRoas - iRoas) / pRoas) * 100 : 0,
    cos,
    acos:      cos,
    gcos:      cos,
    ncac:      iPurchases > 0 ? spend / iPurchases : 0,
    cac:       purchases > 0 ? spend / purchases : 0,
    mer:       cos,
    ctr:       impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpm:       impressions > 0 ? (spend / impressions) * 1000 : 0,
    cpc:       clicks > 0 ? spend / clicks : 0,
    frequency: impressions > 0 ? freqSum / impressions : 0,
    atcRate:   impressions > 0 ? (atc / impressions) * 100 : 0,
    views3sec,
    views25pct,
    reach,
    thumbStopRatio: impressions > 0
      ? (views3sec  > 0 ? views3sec  / impressions : thumbStopSum / impressions)
      : 0,
    hookRate: impressions > 0
      ? (views25pct > 0 ? views25pct / impressions : hookRateSum  / impressions)
      : 0,
    holdRate:     views3sec  > 0 ? views25pct / views3sec : 0,
    clickPerView: views3sec  > 0 ? clicks     / views3sec : 0,
    atcToPurchaseRate:      atc       > 0 ? purchases / atc       : 0,
    checkoutToPurchaseRate: checkouts > 0 ? purchases / checkouts : 0,
    costPerCheckout: checkouts > 0 ? spend / checkouts : 0,
    costPerAtc:      atc       > 0 ? spend / atc       : 0,
    purchaseGapPct: purchases > 0 ? ((purchases - (iPurchases ?? 0)) / purchases) * 100 : 0,
    revenueGapPct:  revenue   > 0 ? ((revenue   - (iRevenue   ?? 0)) / revenue)   * 100 : 0,
    attrMultiple:   iRoas > 0 && iRoas != null ? pRoas / iRoas : 0,
  }
}

export function filterByDateRange(rows, start, end) {
  return rows.filter(r => r.date >= start && r.date <= end)
}

export function filterByDays(rows, days) {
  const now      = new Date()
  const todayStr = now.toISOString().slice(0, 10)   // exclude today — data is incomplete
  let cutoff
  if (days === 'mtd') {
    cutoff = new Date(now.getFullYear(), now.getMonth(), 1)
  } else {
    cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - days)
    cutoff.setHours(0, 0, 0, 0)
  }
  return rows.filter((r) => new Date(r.date) >= cutoff && r.date < todayStr)
}

export function filterByMonth(rows) {
  const now = new Date()
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return rows.filter((r) => r.date.startsWith(prefix))
}

const ZERO_AGG = () => ({
  spend: 0, revenue: 0, purchases: 0, impressions: 0, clicks: 0,
  atc: 0, checkouts: 0, freqSum: 0,
  iRevenue: 0, iPurchases: 0, iAtc: 0, iCheckouts: 0,
  thumbStopSum: 0, hookRateSum: 0,
  views3sec: 0, views25pct: 0, reach: 0,
})

function accumulate(d, r) {
  d.spend        += r.spend
  d.revenue      += r.revenue
  d.purchases    += r.purchases
  d.impressions  += r.impressions
  d.clicks       += r.clicks
  d.atc          += r.atc
  d.checkouts    += r.checkouts
  d.freqSum      += r.frequency * r.impressions
  d.iRevenue     += r.iRevenue   || 0
  d.iPurchases   += r.iPurchases || 0
  d.iAtc         += r.iAtc       || 0
  d.iCheckouts   += r.iCheckouts || 0
  d.thumbStopSum += (r.thumbStopRatio || 0) * (r.impressions || 0)
  d.hookRateSum  += (r.hookRate       || 0) * (r.impressions || 0)
  d.views3sec  += r.views3sec  || 0
  d.views25pct += r.views25pct || 0
  d.reach      += r.reach      || 0
}

export function groupByDate(rows) {
  const map = {}
  for (const r of rows) {
    if (!map[r.date]) map[r.date] = { date: r.date, ...ZERO_AGG() }
    accumulate(map[r.date], r)
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
}

export function groupByField(rows, field) {
  const map = {}
  for (const r of rows) {
    const key = r[field] ?? 'Other'
    if (!map[key]) map[key] = { label: key, ...ZERO_AGG() }
    accumulate(map[key], r)
  }
  return Object.values(map)
    .map((g) => ({ ...g, ...computeMetrics(g) }))
    .sort((a, b) => b.spend - a.spend)
}

export function groupByCampaign(rows) {
  const map = {}
  for (const r of rows) {
    const key = `${r.funnel_stage}||${r.campaign_name}`
    if (!map[key]) map[key] = { funnel_stage: r.funnel_stage, campaign_name: r.campaign_name, ...ZERO_AGG() }
    accumulate(map[key], r)
  }
  return Object.values(map).map((c) => ({ ...c, ...computeMetrics(c) }))
}

export function groupByAdset(rows) {
  const map = {}
  for (const r of rows) {
    const key = r.adsetName || r.adset_name || 'Unknown'
    if (!map[key]) map[key] = {
      adsetName: key,
      funnel_stage: r.funnel_stage,
      campaign_name: r.campaign_name,
      ...ZERO_AGG(),
    }
    accumulate(map[key], r)
  }
  return Object.values(map)
    .map((g) => ({ ...g, ...computeMetrics(g) }))
    .sort((a, b) => b.spend - a.spend)
}

export function groupByAd(rows) {
  const map = {}
  for (const r of rows) {
    const key = r.ad_name || 'Unknown'
    if (!map[key]) map[key] = {
      ad_name:       key,
      adId:          r.adId || '',
      adsetName:     r.adsetName || '',
      funnel_stage:  r.funnel_stage,
      campaign_name: r.campaign_name,
      contentPillar: r.contentPillar,
      creativeFormat:r.creativeFormat,
      fatigueFlag:   r.fatigueFlag,
      efficiencyFlag:r.efficiencyFlag,
      ...ZERO_AGG(),
    }
    accumulate(map[key], r)
    map[key].fatigueFlag    = r.fatigueFlag    || map[key].fatigueFlag
    map[key].efficiencyFlag = r.efficiencyFlag || map[key].efficiencyFlag
    if (r.adId) map[key].adId = r.adId
  }
  return Object.values(map)
    .map(({ ...g }) => ({ ...g, ...computeMetrics(g) }))
    .sort((a, b) => b.spend - a.spend)
}

// ── KPI definitions (8 north-star metrics) ──────────────────────────────────

export const METRIC_DEFS = [
  {
    key: 'revenue', label: 'Revenue', format: 'currency', higherIsBetter: true,
    description: 'Shopify net sales',
  },
  {
    key: 'spend', label: 'Spend', format: 'currency', higherIsBetter: false,
    description: 'Total ad spend',
  },
  {
    key: 'roas', label: 'ROAS', format: 'decimal', higherIsBetter: true,
    description: 'Revenue ÷ Spend',
  },
  {
    key: 'cos', label: 'COS%', format: 'percent', higherIsBetter: false,
    description: 'Cost of Sales — Spend ÷ Revenue',
  },
  {
    key: 'acos', label: 'ACOS', format: 'percent', higherIsBetter: false,
    description: 'Advertising COS — campaign-attributed basis',
  },
  {
    key: 'gcos', label: 'GCOS%', format: 'percent', higherIsBetter: false,
    description: 'Gross COS — set target for blended channel view',
  },
  {
    key: 'ncac', label: 'NCAC', format: 'currency', higherIsBetter: false,
    description: 'New customer acquisition cost — Spend ÷ Incremental Purchases',
  },
  {
    key: 'cac', label: 'CAC', format: 'currency', higherIsBetter: false,
    description: 'Spend ÷ Purchases',
  },
]

export const DEFAULT_TARGETS = {
  revenue:   20000,
  spend:     5000,
  roas:      3.5,
  cos:       25,
  acos:      25,
  gcos:      20,
  ncac:      55,
  cac:       35,
}

export function getStatus(key, actual, target, higherIsBetter) {
  if (!target || target === 0) return 'neutral'
  const ratio = actual / target
  if (higherIsBetter) {
    if (ratio >= 0.95) return 'green'
    if (ratio >= 0.78) return 'amber'
    return 'red'
  } else {
    if (ratio <= 1.05) return 'green'
    if (ratio <= 1.22) return 'amber'
    return 'red'
  }
}

export function buildBriefing(mtdRows, targets) {
  const agg = aggregateRows(mtdRows)
  const m   = computeMetrics(agg)

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const dataDays    = new Set(mtdRows.map((r) => r.date)).size || 1
  const monthPct    = dataDays / daysInMonth

  const lines = []

  const revTarget   = (targets.revenue ?? 0) * monthPct
  const spendBudget = (targets.spend   ?? 0) * monthPct

  if (revTarget > 0) {
    const pct    = ((agg.revenue / revTarget) * 100).toFixed(0)
    const roasFmt = m.roas.toFixed(2)
    const icon   = pct >= 95 ? '✅' : pct >= 78 ? '⚠️' : '🔴'
    const pace   = pct >= 95 ? 'ahead of pace' : pct >= 78 ? 'close to pace' : 'behind pace'
    lines.push(
      `${icon} A$${agg.revenue.toLocaleString('en-AU', { maximumFractionDigits: 0 })} MTD revenue — ${pct}% of pro-rated A$${revTarget.toLocaleString('en-AU', { maximumFractionDigits: 0 })} target at ${roasFmt}x ROAS, ${pace}.`
    )
  }

  const cosTarget = targets.cos ?? 0
  const cacTarget = targets.cac ?? 0
  const cosIcon   = cosTarget > 0 ? (m.cos <= cosTarget * 1.05 ? '✅' : m.cos <= cosTarget * 1.22 ? '⚠️' : '🔴') : '📊'
  const spendLine = spendBudget > 0
    ? `Spend A$${agg.spend.toLocaleString('en-AU', { maximumFractionDigits: 0 })} (${((agg.spend / spendBudget) * 100).toFixed(0)}% of budget).`
    : `Spend A$${agg.spend.toLocaleString('en-AU', { maximumFractionDigits: 0 })}.`

  lines.push(
    `${cosIcon} COS ${m.cos.toFixed(1)}%${cosTarget > 0 ? ` vs ${cosTarget}% ceiling` : ''} — CAC A$${m.cac.toFixed(2)}, NCAC A$${m.ncac.toFixed(2)}. ${spendLine}`
  )

  return lines
}
