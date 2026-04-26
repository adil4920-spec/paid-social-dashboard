import React, { useMemo, useState } from 'react'
import {
  buildDailyRows, buildRolling, buildDoD, buildMTD,
  decomposeMER, classifyMER, buildBudgetStatus, getAction, generateInsightText,
} from '../utils/insights'

// ── Helpers ────────────────────────────────────────────────────────────────
const f$ = n => n != null ? 'A$' + Math.round(n).toLocaleString('en-AU') : '—'
const fp = (n, sign) => n != null ? (sign && n > 0 ? '+' : '') + n.toFixed(1) + '%' : '—'

const ACTION_COLOR = {
  'Hold':              '#16a34a',
  'Assess tomorrow':   '#d97706',
  'Investigate':       '#dc2626',
  "Don't be reactive": '#4f46e5',
}
const ACTION_BG = {
  'Hold':              'rgba(34,197,94,0.10)',
  'Assess tomorrow':   'rgba(245,158,11,0.12)',
  'Investigate':       'rgba(239,68,68,0.10)',
  "Don't be reactive": 'rgba(99,102,241,0.10)',
}
const MER_COLOR = { stable: '#16a34a', drift: '#d97706', outlier: '#dc2626', unknown: '#6b7280' }
const MER_BG    = { stable: 'rgba(34,197,94,0.10)', drift: 'rgba(245,158,11,0.12)', outlier: 'rgba(239,68,68,0.10)', unknown: '#f3f4f6' }

// ── SVG sparkline ──────────────────────────────────────────────────────────
function Sparkline({ data, color, id }) {
  const vals = (data || []).filter(v => v != null && !isNaN(v))
  if (vals.length < 2) return <div style={{ height: 44 }} />
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = max - min || 1
  const W = 200, H = 44, P = 2
  const pts = vals.map((v, i) => [P + (i / (vals.length - 1)) * (W - 2*P), P + (1 - (v - min) / range) * (H - 2*P)])
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const fill = line + ` L${pts[pts.length-1][0].toFixed(1)},${H} L${P},${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 44 }}>
      <defs>
        <linearGradient id={`si-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#si-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Metric card ────────────────────────────────────────────────────────────
function MetricCard({ label, value, dodPct, lowerIsBetter, sparkData, sparkColor }) {
  const good       = dodPct == null ? null : lowerIsBetter ? dodPct < 0 : dodPct > 0
  const deltaColor = good === null ? '#9ca3af' : good ? '#22c55e' : Math.abs(dodPct) < 5 ? '#f59e0b' : '#ef4444'
  const arrow      = dodPct == null ? '' : dodPct > 0 ? '▲ ' : '▼ '
  return (
    <div className="card flex flex-col" style={{ minHeight: 155 }}>
      <span className="metric-label mb-2">{label}</span>
      <p className="text-[24px] font-bold tracking-tight text-[#111827] leading-none mb-1">{value}</p>
      <p style={{ fontSize: 11, fontWeight: 600, color: deltaColor }}>
        {dodPct != null ? `${arrow}${Math.abs(dodPct).toFixed(1)}% DoD` : '—'}
      </p>
      <div className="mt-auto pt-1">
        <Sparkline data={sparkData} color={sparkColor ?? '#5b4fe9'} id={label} />
      </div>
    </div>
  )
}

// ── Snapshot builder — returns structured parts, no string munging in JSX ──
function buildSnapshotParts({ today, dod, rolling, merClass, decomp, budget, mtd, action, pacerMer, pacerRev }) {
  if (!today) return []
  const merVal = pacerMer ?? today.mer
  const revVal = pacerRev ?? today.revenue
  const parts  = []

  // 1. Headline
  parts.push({
    type: 'headline',
    text: `Revenue landed at ${f$(revVal)} at ${fp(merVal)} MER — ${today.orders ?? '—'} orders at ${f$(today.aov)} AOV.`,
  })

  // 2. DoD + dominant driver
  if (dod && decomp) {
    const merDir  = (dod.mer.abs ?? 0) > 0 ? 'worsened' : 'improved'
    const absStr  = dod.mer.abs != null ? `${Math.abs(dod.mer.abs).toFixed(1)}pp` : ''
    const moves   = [
      dod.spend.pct  != null ? `spend ${dod.spend.pct  > 0 ? 'up' : 'down'} ${Math.abs(dod.spend.pct).toFixed(1)}%`  : null,
      dod.orders.pct != null ? `orders ${dod.orders.pct > 0 ? 'up' : 'down'} ${Math.abs(dod.orders.pct).toFixed(1)}%` : null,
      dod.aov.pct    != null ? `AOV ${dod.aov.pct    > 0 ? 'up' : 'down'} ${Math.abs(dod.aov.pct).toFixed(1)}%`       : null,
    ].filter(Boolean).join(', ')
    parts.push({
      type:  'dod',
      bad:   (dod.mer.abs ?? 0) > 0,
      text:  `MER ${merDir} ${absStr} day-on-day — ${decomp.dominantTag.toLowerCase()}${moves ? ` (${moves})` : ''}.`,
    })
  }

  // 3. 3-day trend — structured so renderer never touches the string
  if (rolling.mer.r3 != null && rolling.mer.r7 != null) {
    const r3    = rolling.mer.r3, r7 = rolling.mer.r7
    const trend = r3 > r7 * 1.02 ? 'worsening' : r3 < r7 * 0.98 ? 'improving' : 'flat'
    const vs14  = rolling.mer.mean14 != null ? `, vs ${fp(rolling.mer.mean14)} 14-day mean` : ''
    parts.push({
      type:   'trend',
      trend,
      prefix: `3-day rolling MER ${fp(r3)}${vs14} — trend is `,
      suffix: ` over the past week (7-day avg ${fp(r7)}).`,
    })
  }

  // 4. Diagnosis
  const issues = []
  const aovDrop   = rolling.aov.r7    && today.aov    ? (rolling.aov.r7    - today.aov)    / rolling.aov.r7    * 100 : 0
  const volDrop   = rolling.orders.r7 && today.orders ? (rolling.orders.r7 - today.orders) / rolling.orders.r7 * 100 : 0
  const ncacDrift = rolling.ncac.r7   && today.ncac   ? (today.ncac - rolling.ncac.r7)     / rolling.ncac.r7   * 100 : 0

  if (aovDrop   > 10)               issues.push(`AOV is ${aovDrop.toFixed(0)}% below its 7-day average — possible product mix shift or discount activity`)
  if (volDrop   > 15)               issues.push(`Order volume is ${volDrop.toFixed(0)}% below its 7-day average — possible creative fatigue or audience saturation`)
  if (ncacDrift > 20)               issues.push(`NCAC is ${ncacDrift.toFixed(0)}% above its 7-day average — new customer acquisition getting more expensive`)
  if (budget?.constrained)          issues.push('Spend is hitting the daily budget cap — revenue potential may be capped')
  if (merClass.status === 'outlier') issues.push(`MER is an outlier (${merClass.detail}) — check for tracking issues or one-off revenue movement`)

  parts.push(issues.length
    ? { type: 'diagnoses', items: issues }
    : { type: 'ok', text: 'No significant anomalies detected — all signals within normal range.' }
  )

  // 5. MTD pace — structured
  if (mtd?.revVsPct != null) {
    const pace = mtd.revVsPct >= 0 ? 'ahead of' : mtd.revVsPct >= -10 ? 'close to' : 'behind'
    parts.push({
      type:   'mtd',
      prefix: 'MTD sits ',
      pct:    mtd.revVsPct,
      suffix: ` vs revenue target — ${pace} pace on day ${mtd.daysElapsed} of ${mtd.daysInMonth}.`,
      good:   mtd.revVsPct >= -10,
    })
  }

  // 6. Action
  parts.push({ type: 'action', action: action.action, reason: action.reason })

  return parts
}

// ── Snapshot card ──────────────────────────────────────────────────────────
function SnapshotCard({ parts, merClass, action }) {
  if (!parts.length) return null
  const ac = ACTION_COLOR[action.action] ?? '#6b7280'
  const ab = ACTION_BG[action.action]   ?? '#f3f4f6'
  const mc = MER_COLOR[merClass.status] ?? '#6b7280'
  const mb = MER_BG[merClass.status]    ?? '#f3f4f6'

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="metric-label">Morning Snapshot</p>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: mb, color: mc }}>
            MER {merClass.status.charAt(0).toUpperCase() + merClass.status.slice(1)}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: ab, color: ac }}>
            {action.action}
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {parts.map((p, i) => {
          switch (p.type) {

            case 'headline':
              return <p key={i} className="text-sm font-semibold text-[#111827] leading-relaxed">{p.text}</p>

            case 'dod':
              return <p key={i} className="text-sm leading-relaxed" style={{ color: p.bad ? '#ef4444' : '#16a34a' }}>{p.text}</p>

            case 'trend': {
              const col = p.trend === 'worsening' ? '#ef4444' : p.trend === 'improving' ? '#16a34a' : '#f59e0b'
              return (
                <p key={i} className="text-sm leading-relaxed text-[#374151]">
                  {p.prefix}
                  <span style={{ color: col, fontWeight: 600 }}>{p.trend}</span>
                  {p.suffix}
                </p>
              )
            }

            case 'diagnoses':
              return (
                <div key={i} className="rounded-lg p-3 space-y-1.5"
                     style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.20)' }}>
                  <p className="text-xs font-semibold text-[#d97706] mb-1">Possible causes</p>
                  {p.items.map((item, j) => (
                    <p key={j} className="text-sm text-[#374151] leading-relaxed">
                      <span style={{ color: '#f59e0b', marginRight: 6 }}>•</span>{item}
                    </p>
                  ))}
                </div>
              )

            case 'ok':
              return <p key={i} className="text-sm leading-relaxed" style={{ color: '#16a34a' }}>{p.text}</p>

            case 'mtd':
              return (
                <p key={i} className="text-sm leading-relaxed text-[#374151]">
                  {p.prefix}
                  <span style={{ color: p.good ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                    {fp(p.pct, true)}
                  </span>
                  {p.suffix}
                </p>
              )

            case 'action':
              return (
                <div key={i} className="flex items-start gap-2 pt-2 mt-1" style={{ borderTop: '1px solid #f3f4f6' }}>
                  <span className="px-2 py-0.5 rounded text-xs font-bold shrink-0"
                        style={{ background: ab, color: ac }}>
                    {p.action}
                  </span>
                  <span className="text-sm text-[#6b7280]">{p.reason}</span>
                </div>
              )

            default: return null
          }
        })}
      </div>
    </div>
  )
}

// ── InsightsTab ────────────────────────────────────────────────────────────
export default function InsightsTab({ rows, pacerData }) {
  const [copied, setCopied] = useState(false)

  // All analysis is up to and including yesterday — today's data is incomplete
  const todayStr   = new Date().toISOString().slice(0, 10)
  const pastRows   = useMemo(() => rows.filter(r => r.date < todayStr),               [rows, todayStr])
  const anzDaily   = useMemo(() => (pacerData?.anzDaily ?? []).filter(d => d.date < todayStr), [pacerData, todayStr])

  const daily   = useMemo(() => buildDailyRows(pastRows),       [pastRows])
  const rolling = useMemo(() => buildRolling(daily),            [daily])
  const dod     = useMemo(() => buildDoD(daily),                [daily])
  const mtd     = useMemo(() => buildMTD(daily, pacerData),     [daily, pacerData])

  const today     = daily[daily.length - 1] ?? null   // yesterday in wall-clock time
  const yesterday = daily[daily.length - 2] ?? null

  const decomp   = useMemo(() => decomposeMER(today, yesterday),      [today, yesterday])
  const merClass = useMemo(() => classifyMER(today, rolling, mtd),    [today, rolling, mtd])
  const budget   = useMemo(() => buildBudgetStatus(today, pacerData), [today, pacerData])
  const action   = useMemo(() => getAction(merClass, today, rolling), [merClass, today, rolling])

  const anzLast  = anzDaily[anzDaily.length - 1] ?? null
  const anzPrev  = anzDaily[anzDaily.length - 2] ?? null

  const pacerMer     = anzLast?.mer          ?? null
  const pacerRev     = anzLast?.revenue      ?? null
  const pacerSpend   = anzLast?.spend        ?? null
  const pacerNC      = anzLast?.newCustomers ?? null
  const pacerNcac    = anzLast?.ncac         ?? null

  function anzDod(key) {
    const t = anzLast?.[key], y = anzPrev?.[key]
    return (t != null && y != null && y !== 0) ? (t - y) / Math.abs(y) * 100 : null
  }

  const pacerMerDod = anzDod('mer')  ?? dod?.mer?.pct  ?? null
  const pacerRevDod = anzDod('revenue')                ?? null

  const snapshotParts = useMemo(
    () => buildSnapshotParts({ today, dod, rolling, merClass, decomp, budget, mtd, action, pacerMer, pacerRev }),
    [today, dod, rolling, merClass, decomp, budget, mtd, action, pacerMer]
  )

  const insightText = useMemo(
    () => generateInsightText({ today, dod, rolling, merClass, decomp, budget, mtd, action }),
    [today, dod, rolling, merClass, decomp, budget, mtd, action]
  )

  function copySlack() {
    if (!insightText) return
    navigator.clipboard.writeText(insightText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!today) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm text-[#9ca3af]">No daily data available yet.</p>
      </div>
    )
  }

  const daysElapsedPct = mtd ? (mtd.daysElapsed / mtd.daysInMonth) * 100 : 0
  const spark      = key => daily.slice(-14).map(d => d[key])
  const anzSpark   = key => anzDaily.slice(-14).map(d => d[key])
  const revSpark   = anzDaily.length >= 3 ? anzSpark('revenue') : spark('revenue')
  const merSpark   = anzDaily.length >= 3 ? anzSpark('mer')     : spark('mer')
  const merColor  = (() => {
    const r3 = rolling.mer.r3, r7 = rolling.mer.r7
    if (!r3 || !r7) return '#5b4fe9'
    return r3 > r7 * 1.02 ? '#ef4444' : r3 < r7 * 0.98 ? '#22c55e' : '#f59e0b'
  })()

  return (
    <div className="space-y-5">

      {/* ── Morning snapshot ──────────────────────────────────────────────── */}
      <SnapshotCard parts={snapshotParts} merClass={merClass} action={action} />

      {/* ── Yesterday metric cards ────────────────────────────────────────── */}
      <div>
        <p className="metric-label mb-3">Yesterday — {today.date}</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <MetricCard label="Revenue" value={f$(pacerRev ?? today.revenue)}  dodPct={pacerRevDod ?? dod?.revenue.pct} lowerIsBetter={false} sparkData={revSpark}         sparkColor="#5b4fe9" />
          <MetricCard label="Spend"   value={f$(pacerSpend ?? today.spend)} dodPct={anzDod('spend') ?? dod?.spend.pct}   lowerIsBetter={true}  sparkData={anzDaily.length >= 3 ? anzSpark('spend') : spark('spend')} sparkColor="#6b7280" />
          <MetricCard label="MER"     value={fp(pacerMer ?? today.mer)}   dodPct={pacerMerDod}      lowerIsBetter={true}  sparkData={merSpark}          sparkColor={merColor} />
          <MetricCard label="Orders"  value={String(today.orders ?? '—')} dodPct={dod?.orders.pct}  lowerIsBetter={false} sparkData={spark('orders')}  sparkColor="#5b4fe9" />
          <MetricCard label="AOV"     value={f$(today.aov)}               dodPct={dod?.aov.pct}     lowerIsBetter={false} sparkData={spark('aov')}      sparkColor="#5b4fe9" />
        </div>
      </div>

      {/* ── Rolling averages + MTD ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="card">
          <p className="metric-label mb-3">Rolling Averages</p>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="helper-text font-medium pb-2 text-left w-24">Metric</th>
                <th className="helper-text font-medium pb-2 text-right">3-day</th>
                <th className="helper-text font-medium pb-2 text-right">7-day</th>
                <th className="helper-text font-medium pb-2 text-right">14-day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {[
                { label: 'MER',    v3: fp(rolling.mer.r3),                    v7: fp(rolling.mer.r7),                    v14: rolling.mer.mean14 != null ? `${fp(rolling.mer.mean14)} ±${rolling.mer.sd14?.toFixed(1) ?? '—'}` : '—' },
                { label: 'AOV',    v3: f$(rolling.aov.r3),                    v7: f$(rolling.aov.r7),                    v14: '—' },
                { label: 'Orders', v3: rolling.orders.r3?.toFixed(0) ?? '—',  v7: rolling.orders.r7?.toFixed(0) ?? '—',  v14: '—' },
                { label: 'Spend',  v3: f$(rolling.spend.r3),                  v7: f$(rolling.spend.r7),                  v14: '—' },
              ].map(row => (
                <tr key={row.label}>
                  <td className="py-1.5 text-[#374151] font-medium">{row.label}</td>
                  <td className="py-1.5 text-right text-[#111827]">{row.v3}</td>
                  <td className="py-1.5 text-right text-[#111827]">{row.v7}</td>
                  <td className="py-1.5 text-right helper-text">{row.v14}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {mtd && (
          <div className="card">
            <p className="metric-label mb-3">MTD — day {mtd.daysElapsed}/{mtd.daysInMonth}</p>
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="helper-text">Month progress</span>
                <span className="helper-text">{daysElapsedPct.toFixed(0)}%</span>
              </div>
              <div className="h-[5px] rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
                <div className="h-full rounded-full" style={{ width: `${daysElapsedPct}%`, background: '#5b4fe9' }} />
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[#f3f4f6]">
                <tr>
                  <td className="py-1.5 helper-text">Revenue</td>
                  <td className="py-1.5 text-right font-semibold text-[#111827]">
                    {f$(mtd.shopifyRev ?? mtd.rev)}
                    {mtd.revVsPct != null && (
                      <span className="ml-2 text-xs font-semibold"
                            style={{ color: mtd.revVsPct >= 0 ? '#22c55e' : '#ef4444' }}>
                        {fp(mtd.revVsPct, true)} vs target
                      </span>
                    )}
                  </td>
                </tr>
                {[
                  { label: 'MER',    value: fp(mtd.mer) },
                  { label: 'Orders', value: (mtd.orders || 0).toLocaleString() },
                  { label: 'AOV',    value: f$(mtd.aov) },
                ].map(row => (
                  <tr key={row.label}>
                    <td className="py-1.5 helper-text">{row.label}</td>
                    <td className="py-1.5 text-right font-semibold text-[#111827]">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Acquisition + Budget ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="card">
          <p className="metric-label mb-3">Acquisition</p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[#f3f4f6]">
              {[
                { label: 'NCAC yesterday',     value: f$(pacerNcac ?? today.ncac) },
                { label: 'NCAC 7-day avg',     value: f$(rolling.ncac.r7) },
                { label: 'New customers',       value: pacerNC ?? today.newCustomers ?? '—' },
                { label: 'New customer share',  value: fp(today.newCustomerShare) },
              ].map(row => (
                <tr key={row.label}>
                  <td className="py-1.5 helper-text">{row.label}</td>
                  <td className="py-1.5 text-right font-semibold text-[#111827]">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {budget && (
          <div className="card">
            <p className="metric-label mb-3">Budget</p>
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="helper-text">Daily utilisation</span>
                <span className="text-xs font-semibold"
                      style={{ color: budget.constrained ? '#ef4444' : '#22c55e' }}>
                  {budget.util.toFixed(0)}%
                </span>
              </div>
              <div className="h-[5px] rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
                <div className="h-full rounded-full"
                     style={{ width: `${Math.min(budget.util, 100)}%`, background: budget.constrained ? '#ef4444' : '#22c55e' }} />
              </div>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[#f3f4f6]">
                {[
                  { label: 'Yesterday spend', value: f$(today.spend), color: null },
                  { label: 'Daily cap',        value: f$(budget.dailyCap), color: null },
                  { label: 'Status',           value: budget.flag, color: budget.constrained ? '#ef4444' : '#22c55e' },
                ].map(row => (
                  <tr key={row.label}>
                    <td className="py-1.5 helper-text">{row.label}</td>
                    <td className="py-1.5 text-right font-semibold"
                        style={{ color: row.color ?? '#111827' }}>
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Copy for Slack ────────────────────────────────────────────────── */}
      {insightText && (
        <div className="flex justify-end">
          <button
            onClick={copySlack}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
            style={{
              background: copied ? 'rgba(34,197,94,0.10)' : '#111827',
              color: copied ? '#16a34a' : '#fff',
            }}
          >
            {copied ? '✓ Copied to clipboard' : 'Copy for Slack'}
          </button>
        </div>
      )}
    </div>
  )
}
