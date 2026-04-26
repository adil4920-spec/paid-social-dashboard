// ── Thresholds — edit here to adjust sensitivity ──────────────────────────
export const INSIGHT_CONFIG = {
  mer:    { outlierSDs: 2, driftPct: 5, target: 18 },
  aov:    { dropPct: 15 },
  volume: { dropPct: 20 },
  ncac:   { driftPct: 20 },
  budget: { constrainedPct: 95, healthyPct: 90 },
}

// ── Rolling utilities (reusable for any metric) ────────────────────────────
export function rollingMean(arr, n) {
  const w = arr.filter(v => v != null).slice(-n)
  return w.length >= n ? w.reduce((a, b) => a + b, 0) / n : null
}

export function rollingStdDev(arr, n) {
  const w = arr.filter(v => v != null).slice(-n)
  if (w.length < n) return null
  const mean = w.reduce((a, b) => a + b, 0) / n
  return Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
}

// ── Daily aggregation (region-ready: pass pre-filtered rows) ──────────────
export function buildDailyRows(rows) {
  const map = {}
  for (const r of rows) {
    if (!map[r.date]) map[r.date] = { date: r.date, spend: 0, revenue: 0, orders: 0, newCustomers: 0 }
    const d = map[r.date]
    d.spend        += r.spend      || 0
    d.revenue      += r.revenue    || 0
    d.orders       += r.purchases  || 0
    d.newCustomers += r.iPurchases || 0
  }
  return Object.values(map)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      ...d,
      mer:              d.revenue > 0      ? (d.spend / d.revenue) * 100     : null,
      aov:              d.orders  > 0      ? d.revenue / d.orders            : null,
      ncac:             d.newCustomers > 0 ? d.spend / d.newCustomers        : null,
      newCustomerShare: d.orders  > 0      ? (d.newCustomers / d.orders) * 100 : null,
    }))
}

// ── Rolling metrics for all windows ───────────────────────────────────────
export function buildRolling(daily) {
  const v = k => daily.map(d => d[k])
  return {
    mer:    { r3: rollingMean(v('mer'),    3), r7: rollingMean(v('mer'),    7), mean14: rollingMean(v('mer'), 14), sd14: rollingStdDev(v('mer'), 14) },
    aov:    { r3: rollingMean(v('aov'),    3), r7: rollingMean(v('aov'),    7) },
    orders: { r3: rollingMean(v('orders'), 3), r7: rollingMean(v('orders'), 7) },
    spend:  { r3: rollingMean(v('spend'),  3), r7: rollingMean(v('spend'),  7) },
    ncac:   { r7: rollingMean(v('ncac'),   7) },
  }
}

// ── DoD deltas ─────────────────────────────────────────────────────────────
export function buildDoD(daily) {
  if (daily.length < 2) return null
  const t = daily[daily.length - 1]
  const y = daily[daily.length - 2]
  const d = k => (t[k] == null || y[k] == null)
    ? { abs: null, pct: null }
    : { abs: t[k] - y[k], pct: y[k] !== 0 ? (t[k] - y[k]) / Math.abs(y[k]) * 100 : null }
  return { revenue: d('revenue'), spend: d('spend'), mer: d('mer'), orders: d('orders'), aov: d('aov'), ncac: d('ncac') }
}

// ── MTD context ────────────────────────────────────────────────────────────
export function buildMTD(daily, pacerData) {
  const now = new Date()
  const pfx = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const mtd = daily.filter(d => d.date.startsWith(pfx))
  if (!mtd.length) return null

  const daysElapsed = mtd.length
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const rev    = mtd.reduce((a, d) => a + d.revenue, 0)
  const spend  = mtd.reduce((a, d) => a + d.spend,   0)
  const orders = mtd.reduce((a, d) => a + d.orders,  0)

  const anz        = k => pacerData?.metrics[k]?.[1] ?? null
  const shopifyRev = anz('revActual')
  const revTarget  = anz('revTarget') ?? 0
  const revVsPct   = revTarget > 0 ? ((shopifyRev ?? rev) / revTarget - 1) * 100 : null

  return {
    daysElapsed, daysInMonth,
    rev, spend, orders,
    mer: rev > 0 ? (spend / rev) * 100 : null,
    aov: orders > 0 ? rev / orders : null,
    shopifyRev, revTarget, revVsPct,
  }
}

// ── MER decomposition → dominant driver tag ────────────────────────────────
export function decomposeMER(today, yesterday) {
  if (!today || !yesterday || today.mer == null || yesterday.mer == null) return null
  const sc = yesterday.spend  > 0 ? (today.spend  - yesterday.spend)  / yesterday.spend  * 100 : 0
  const vc = yesterday.orders > 0 ? (today.orders - yesterday.orders) / yesterday.orders * 100 : 0
  const ac = yesterday.aov    > 0 ? (today.aov    - yesterday.aov)    / yesterday.aov    * 100 : 0
  const drivers = [
    { tag: 'Spend-driven',  contrib:  sc },
    { tag: 'Volume-driven', contrib: -vc },
    { tag: 'AOV-driven',    contrib: -ac },
  ]
  const dom = drivers.reduce((a, b) => Math.abs(a.contrib) > Math.abs(b.contrib) ? a : b)
  return { spendChg: sc, volumeChg: vc, aovChg: ac, dominantTag: dom.tag }
}

// ── Outlier / drift classifier ─────────────────────────────────────────────
export function classifyMER(today, rolling, mtd, cfg = INSIGHT_CONFIG) {
  if (today?.mer == null) return { status: 'unknown', detail: null }
  const { mean14, sd14, r3 } = rolling.mer
  if (mean14 != null && sd14 != null && sd14 > 0) {
    const z = Math.abs(today.mer - mean14) / sd14
    if (z >= cfg.mer.outlierSDs)
      return { status: 'outlier', detail: `${z.toFixed(1)}σ from 14-day mean (${mean14.toFixed(1)}%)` }
  }
  if (r3 != null && mtd?.mer != null) {
    const drift = (r3 - mtd.mer) / mtd.mer * 100
    if (Math.abs(drift) > cfg.mer.driftPct)
      return { status: 'drift', detail: `3-day rolling ${r3.toFixed(1)}% vs MTD baseline ${mtd.mer.toFixed(1)}% (${drift > 0 ? '+' : ''}${drift.toFixed(1)}%)` }
  }
  return { status: 'stable', detail: 'Within normal range' }
}

// ── Budget status ──────────────────────────────────────────────────────────
export function buildBudgetStatus(today, pacerData, cfg = INSIGHT_CONFIG) {
  const monthly = pacerData?.metrics?.spendBudget?.[1] ?? null
  if (!monthly || !today) return null
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const dailyCap = monthly / daysInMonth
  const util = today.spend > 0 ? today.spend / dailyCap * 100 : 0
  return {
    dailyCap, util,
    constrained: util >= cfg.budget.constrainedPct,
    flag: util >= cfg.budget.constrainedPct ? 'Budget constrained' : util < cfg.budget.healthyPct ? 'Budget healthy' : 'Near cap',
  }
}

// ── Action recommendation ──────────────────────────────────────────────────
export function getAction(merClass, today, rolling, cfg = INSIGHT_CONFIG) {
  const aovDrop   = rolling.aov.r7    && today?.aov    ? (rolling.aov.r7    - today.aov)    / rolling.aov.r7    * 100 : 0
  const volDrop   = rolling.orders.r7 && today?.orders ? (rolling.orders.r7 - today.orders) / rolling.orders.r7 * 100 : 0
  const ncacDrift = rolling.ncac.r7   && today?.ncac   ? (today.ncac - rolling.ncac.r7)     / rolling.ncac.r7   * 100 : 0

  if (merClass.status === 'outlier') {
    const r3Drift = rolling.mer.r3 && rolling.mer.mean14
      ? Math.abs((rolling.mer.r3 - rolling.mer.mean14) / rolling.mer.mean14 * 100) : 0
    return r3Drift < 5
      ? { action: "Don't be reactive", reason: 'Single-day MER spike with no supporting 3-day trend' }
      : { action: 'Investigate',       reason: 'MER outlier with corroborating 3-day trend' }
  }
  const issues = [
    aovDrop   > cfg.aov.dropPct    ? `AOV −${aovDrop.toFixed(0)}% vs 7-day`    : null,
    volDrop   > cfg.volume.dropPct ? `Orders −${volDrop.toFixed(0)}% vs 7-day` : null,
    ncacDrift > cfg.ncac.driftPct  ? `NCAC +${ncacDrift.toFixed(0)}% vs 7-day` : null,
  ].filter(Boolean)
  if (issues.length) return { action: 'Investigate', reason: issues.join(' · ') }
  if (merClass.status === 'drift') return { action: 'Assess tomorrow', reason: merClass.detail }
  return { action: 'Hold', reason: 'All signals stable' }
}

// ── Insight text (Slack-ready) ─────────────────────────────────────────────
export function generateInsightText({ today, dod, rolling, merClass, decomp, budget, mtd, action }) {
  if (!today) return null
  const f$ = n => n != null ? 'A$' + Math.round(n).toLocaleString('en-AU') : '—'
  const fp = (n, s) => n != null ? (s && n > 0 ? '+' : '') + n.toFixed(1) + '%' : '—'

  const lines = []
  lines.push(`Landed at ${f$(today.revenue)} at ${fp(today.mer)} MER — ${today.orders ?? '—'} orders, AOV ${f$(today.aov)}.`)

  if (dod && decomp) {
    const dir = (dod.mer.abs ?? 0) > 0 ? 'worsened' : 'improved'
    lines.push(`MER ${dir} ${fp(dod.mer.abs, true)}pp DoD. ${decomp.dominantTag} (spend ${fp(dod.spend.pct, true)}, orders ${fp(dod.orders.pct, true)}, AOV ${fp(dod.aov.pct, true)}).`)
  }

  if (rolling.mer.r3 != null && rolling.mer.r7 != null)
    lines.push(`Trend: 3-day rolling MER ${fp(rolling.mer.r3)} · 7-day ${fp(rolling.mer.r7)}.`)

  if (mtd)
    lines.push(`MTD: ${f$(mtd.shopifyRev ?? mtd.rev)} revenue${mtd.revVsPct != null ? ` (${fp(mtd.revVsPct, true)} vs target)` : ''} · ${fp(mtd.mer)} MER · ${(mtd.orders || 0).toLocaleString()} orders — day ${mtd.daysElapsed}/${mtd.daysInMonth}.`)

  if (budget)
    lines.push(`Budget: ${f$(today.spend)} spend vs ${f$(budget.dailyCap)} daily cap (${budget.util.toFixed(0)}% utilised) — ${budget.flag}.`)

  lines.push(`\nAction: ${action.action}. ${action.reason}.`)
  return lines.join('\n')
}
